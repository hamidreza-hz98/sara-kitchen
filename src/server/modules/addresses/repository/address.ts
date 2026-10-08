import "server-only";

import { Types } from "mongoose";
import type { Connection } from "mongoose";

import { createActorMetadata } from "@/server/database/schema";

import {
  getAddressModel,
  type AddressPoint,
  type AddressValidationMetadata,
} from "../model/address";
import { planDefaultAddressCreate, replacementDefaultAddressId } from "../policy/default-address";
import type { AddressUpdateInput, AddressWriteInput } from "../validation/address";

export type AddressSnapshot = Readonly<{
  id: string;
  customerId: string;
  name: string;
  recipientName: string;
  recipientMobile: string;
  formattedAddress: string;
  location: AddressPoint;
  postalCode: string;
  deliveryNotes: string | null;
  isDefault: boolean;
  validation: Readonly<{
    status: AddressValidationMetadata["status"];
    provider: AddressValidationMetadata["provider"];
    providerReference: string | null;
    checkedAt: string | null;
  }>;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export class AddressRepositoryConflictError extends Error {
  constructor() {
    super("address_conflict");
    this.name = "AddressRepositoryConflictError";
  }
}

export interface AddressRepository {
  listForCustomer(customerId: string): Promise<readonly AddressSnapshot[]>;
  findOwnedById(customerId: string, addressId: string): Promise<AddressSnapshot | null>;
  create(customerId: string, value: AddressWriteInput, actorId: string): Promise<AddressSnapshot>;
  save(
    current: AddressSnapshot,
    value: AddressUpdateInput,
    actorId: string,
  ): Promise<AddressSnapshot>;
  makeDefault(current: AddressSnapshot, actorId: string): Promise<AddressSnapshot>;
  softDelete(current: AddressSnapshot, actorId: string, now: Date): Promise<AddressSnapshot>;
}

function snapshot(document: InstanceType<ReturnType<typeof getAddressModel>>): AddressSnapshot {
  return {
    id: document._id.toHexString(),
    customerId: document.customerId.toHexString(),
    name: document.name,
    recipientName: document.recipientName,
    recipientMobile: document.recipientMobile,
    formattedAddress: document.formattedAddress,
    location: {
      type: "Point",
      coordinates: [document.location.coordinates[0], document.location.coordinates[1]],
    },
    postalCode: document.postalCode,
    deliveryNotes: document.deliveryNotes,
    isDefault: document.isDefault,
    validation: {
      status: document.validation.status,
      provider: document.validation.provider,
      providerReference: document.validation.providerReference,
      checkedAt: document.validation.checkedAt?.toISOString() ?? null,
    },
    version: Number(document.get("__v") ?? 0),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function conflict(error?: unknown): AddressRepositoryConflictError {
  return Object.assign(new AddressRepositoryConflictError(), { cause: error });
}

function isPersistenceConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === 11_000) ||
      ("name" in error && error.name === "VersionError"))
  );
}

function applyUpdate(
  document: InstanceType<ReturnType<typeof getAddressModel>>,
  value: AddressUpdateInput,
) {
  if (value.name !== undefined) document.name = value.name;
  if (value.recipientName !== undefined) document.recipientName = value.recipientName;
  if (value.recipientMobile !== undefined) document.recipientMobile = value.recipientMobile;
  if (value.formattedAddress !== undefined) document.formattedAddress = value.formattedAddress;
  if (value.location !== undefined) document.location = { ...value.location };
  if (value.postalCode !== undefined) document.postalCode = value.postalCode;
  if (value.deliveryNotes !== undefined) document.deliveryNotes = value.deliveryNotes;
  if (
    value.formattedAddress !== undefined ||
    value.location !== undefined ||
    value.postalCode !== undefined
  ) {
    document.validation = {
      status: "unverified",
      provider: null,
      providerReference: null,
      checkedAt: null,
    };
  }
}

export function createAddressRepository(connection: Connection): AddressRepository {
  const Address = getAddressModel(connection);
  const activeOwnerFilter = (customerId: string) => ({
    customerId: new Types.ObjectId(customerId),
    deletedAt: null,
  });
  const load = async (current: AddressSnapshot) => {
    const document = await Address.findOne({
      _id: new Types.ObjectId(current.id),
      ...activeOwnerFilter(current.customerId),
    });
    if (!document || Number(document.get("__v") ?? 0) !== current.version) throw conflict();
    return document;
  };
  const persist = async (document: InstanceType<typeof Address>) => {
    try {
      await document.save();
      return snapshot(document);
    } catch (error) {
      if (isPersistenceConflict(error)) throw conflict(error);
      throw error;
    }
  };

  const makeDefault = async (current: AddressSnapshot, actorId: string) => {
    if (current.isDefault) return current;
    const document = await load(current);
    const previous = await Address.findOne({
      ...activeOwnerFilter(current.customerId),
      isDefault: true,
    });
    if (previous) {
      previous.isDefault = false;
      previous.updatedBy = createActorMetadata("customer", actorId);
      await persist(previous);
    }
    try {
      document.isDefault = true;
      document.updatedBy = createActorMetadata("customer", actorId);
      return await persist(document);
    } catch (error) {
      if (previous) {
        try {
          const rollback = await Address.findById(previous._id);
          if (rollback && !rollback.deletedAt) {
            rollback.isDefault = true;
            rollback.updatedBy = createActorMetadata("customer", actorId);
            await rollback.save();
          }
        } catch {
          // The unique index still prevents two defaults; SK-0130 reports a conflict for retry.
        }
      }
      throw error;
    }
  };

  return {
    async listForCustomer(customerId) {
      if (!Types.ObjectId.isValid(customerId)) return [];
      const documents = await Address.find(activeOwnerFilter(customerId)).sort({
        isDefault: -1,
        createdAt: 1,
        _id: 1,
      });
      return documents.map(snapshot);
    },
    async findOwnedById(customerId, addressId) {
      if (!Types.ObjectId.isValid(customerId) || !Types.ObjectId.isValid(addressId)) return null;
      const document = await Address.findOne({
        _id: new Types.ObjectId(addressId),
        ...activeOwnerFilter(customerId),
      });
      return document ? snapshot(document) : null;
    },
    async create(customerId, value, actorId) {
      const activeCount = await Address.countDocuments(activeOwnerFilter(customerId));
      const plan = planDefaultAddressCreate(activeCount, value.isDefault);
      const document = new Address({
        ...value,
        customerId: new Types.ObjectId(customerId),
        isDefault: plan.unsetCurrentDefault ? false : plan.isDefault,
      });
      document.createdBy = createActorMetadata("customer", actorId);
      document.updatedBy = createActorMetadata("customer", actorId);
      let created: AddressSnapshot;
      try {
        created = await persist(document);
      } catch (error) {
        if (
          plan.isDefault &&
          activeCount === 0 &&
          error instanceof AddressRepositoryConflictError
        ) {
          document.isDefault = false;
          created = await persist(document);
        } else {
          throw error;
        }
      }
      if (!plan.unsetCurrentDefault) return created;
      try {
        return await makeDefault(created, actorId);
      } catch (error) {
        await Address.deleteOne({ _id: new Types.ObjectId(created.id), __v: created.version });
        throw error;
      }
    },
    async save(current, value, actorId) {
      const document = await load(current);
      applyUpdate(document, value);
      document.updatedBy = createActorMetadata("customer", actorId);
      return persist(document);
    },
    makeDefault,
    async softDelete(current, actorId, now) {
      const document = await load(current);
      if (document.isDefault) {
        const survivors = await Address.find({
          ...activeOwnerFilter(current.customerId),
          _id: { $ne: document._id },
        })
          .sort({ createdAt: 1, _id: 1 })
          .select("_id")
          .lean();
        const replacementId = replacementDefaultAddressId(
          true,
          survivors.map((entry) => entry._id.toHexString()),
        );
        if (replacementId) {
          document.isDefault = false;
          document.updatedBy = createActorMetadata("customer", actorId);
          await persist(document);
          const replacement = await Address.findById(replacementId);
          if (!replacement || replacement.deletedAt) throw conflict();
          replacement.isDefault = true;
          replacement.updatedBy = createActorMetadata("customer", actorId);
          await persist(replacement);
        }
      }
      document.deletedAt = now;
      document.deletedBy = createActorMetadata("customer", actorId);
      document.updatedBy = createActorMetadata("customer", actorId);
      return persist(document);
    },
  };
}
