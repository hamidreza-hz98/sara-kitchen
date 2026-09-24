import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { SeoFields, type SeoEditorValues } from "@/components/seo";
import messages from "@/locales/messages/en";

const fields = {
  title: "Fesenjan — Persian food in Porto",
  description: "Order homemade Persian walnut and pomegranate stew in Porto.",
  keywords: "fesenjan, Persian food, Porto",
  openGraphTitle: "",
  openGraphDescription: "",
  twitterTitle: "",
  twitterDescription: "",
};
const modes = {
  title: "automatic",
  description: "automatic",
  keywords: "automatic",
  openGraphTitle: "automatic",
  openGraphDescription: "automatic",
  twitterTitle: "automatic",
  twitterDescription: "automatic",
} as const;
const initial: SeoEditorValues = {
  locales: { en: fields, "pt-PT": fields, fa: fields },
  modes: { en: modes, "pt-PT": modes, fa: modes },
  canonicalUrl: "https://sarakitchen.pt/menu/fesenjan",
  canonicalMode: "automatic",
};

function Harness() {
  const [value, setValue] = useState(initial);
  return <SeoFields values={value} onChange={setValue} />;
}

describe("SEO fields", () => {
  it("makes ownership, fallback state, character guidance and preview explicit", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Harness />
      </NextIntlClientProvider>,
    );

    expect(screen.getAllByText("Automatic").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Currently inherits the generated entity fallback.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/32\/70 characters/u)).toBeInTheDocument();
    expect(screen.getByText("Social preview")).toBeInTheDocument();
    expect(screen.getByText("Fesenjan — Persian food in Porto")).toBeInTheDocument();
  });

  it("takes manual ownership of one field without changing the others", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Harness />
      </NextIntlClientProvider>,
    );

    const title = screen.getByLabelText("Search title");
    expect(title).toBeDisabled();
    fireEvent.click(screen.getAllByRole("switch")[0]!);
    expect(title).toBeEnabled();
    expect(screen.getByText("Manual overrides")).toBeInTheDocument();
    expect(screen.getAllByText("Automatic").length).toBeGreaterThan(0);
  });
});
