export interface EnvironmentIssue {
  path: PropertyKey[];
  message: string;
}

export class EnvironmentValidationError extends Error {
  readonly issues: readonly EnvironmentIssue[];

  constructor(scope: "client" | "server" | "environment", issues: readonly EnvironmentIssue[]) {
    const details = issues
      .map(({ path, message }) => `- ${path.join(".") || scope}: ${message}`)
      .join("\n");
    const heading =
      scope === "environment"
        ? "Invalid environment configuration"
        : `Invalid ${scope} environment configuration`;

    super(
      `${heading}:\n${details}\n` +
        "Review .env.example and provide valid values without committing secrets.",
    );
    this.name = "EnvironmentValidationError";
    this.issues = issues;
  }
}
