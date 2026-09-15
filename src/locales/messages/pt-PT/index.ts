import dashboard from "./dashboard.json";
import entities from "./entities.json";
import errors from "./errors.json";
import profile from "./profile.json";
import shared from "./shared.json";
import storefront from "./storefront.json";
import validation from "./validation.json";

const messages = {
  dashboard,
  entities,
  errors,
  profile,
  shared,
  storefront,
  validation,
} as const;

export default messages;
