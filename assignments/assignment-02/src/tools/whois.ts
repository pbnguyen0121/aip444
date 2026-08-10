export interface WhoisResult {
  domain: string;
  registrantOrganization: string | null;
  registrationDate: string | null;
  expirationDate: string | null;
  registrar: string | null;
  country: string | null;
  isRedacted: boolean;
  source: string;
  error: string | null;
}

type VcardEntry = [string, unknown, string, string];

const multiLabelPublicSuffixes = new Set([
  "ac.uk",
  "co.jp",
  "co.nz",
  "co.uk",
  "co.in",
  "co.kr",
  "co.za",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.mx",
  "com.sg",
  "com.tr",
  "com.tw",
  "edu.au",
  "gov.uk",
  "net.au",
  "org.au",
  "org.uk",
]);

function normalizeHostname(input: string): string {
  const trimmed = input.trim().toLowerCase();

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^www\./, "").replace(/\/.*$/, "");
  }
}

export function getRegistrableDomain(input: string): string {
  const hostname = normalizeHostname(input);
  const labels = hostname.split(".").filter(Boolean);

  if (labels.length <= 2) {
    return hostname;
  }

  const lastTwo = labels.slice(-2).join(".");

  if (multiLabelPublicSuffixes.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return lastTwo;
}

function readVcardValue(entity: any, key: string): string | null {
  const entries = entity?.vcardArray?.[1];

  if (!Array.isArray(entries)) {
    return null;
  }

  const match = entries.find(
    (entry: unknown): entry is VcardEntry =>
      Array.isArray(entry) && entry[0] === key && typeof entry[3] === "string",
  );

  return match?.[3] ?? null;
}

function findEventDate(data: any, actionNames: string[]): string | null {
  const events = Array.isArray(data.events) ? data.events : [];

  for (const event of events) {
    const action = String(event.eventAction ?? "").toLowerCase();

    if (
      actionNames.some((name) => action.includes(name)) &&
      typeof event.eventDate === "string"
    ) {
      return event.eventDate;
    }
  }

  return null;
}

function findEntity(data: any, role: string): any | null {
  const entities = Array.isArray(data.entities) ? data.entities : [];

  return (
    entities.find(
      (entity: any) =>
        Array.isArray(entity.roles) &&
        entity.roles.some((item: unknown) => String(item).toLowerCase() === role),
    ) ?? null
  );
}

function detectRedaction(data: any): boolean {
  const serialized = JSON.stringify({
    notices: data.notices ?? [],
    remarks: data.remarks ?? [],
    entities: data.entities ?? [],
  }).toLowerCase();

  return (
    serialized.includes("redacted") ||
    serialized.includes("privacy") ||
    serialized.includes("private") ||
    serialized.includes("data protected")
  );
}

export async function lookupWhois(domainInput: string): Promise<WhoisResult> {
  const domain = getRegistrableDomain(domainInput);
  const source = `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return {
      domain,
      registrantOrganization: null,
      registrationDate: null,
      expirationDate: null,
      registrar: null,
      country: null,
      isRedacted: false,
      source,
      error: "Invalid domain name.",
    };
  }

  try {
    const response = await fetch(source, {
      headers: {
        Accept: "application/rdap+json, application/json",
      },
    });

    if (!response.ok) {
      return {
        domain,
        registrantOrganization: null,
        registrationDate: null,
        expirationDate: null,
        registrar: null,
        country: null,
        isRedacted: false,
        source,
        error:
          response.status === 404
            ? "Domain was not found in RDAP."
            : `RDAP lookup failed with HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as any;
    const registrant = findEntity(data, "registrant");
    const registrarEntity = findEntity(data, "registrar");
    const publicIds = Array.isArray(data.publicIds) ? data.publicIds : [];

    const registrar =
      readVcardValue(registrarEntity, "fn") ??
      readVcardValue(registrarEntity, "org") ??
      (typeof data.registrarName === "string" ? data.registrarName : null) ??
      (typeof publicIds[0]?.identifier === "string"
        ? publicIds[0].identifier
        : null);

    return {
      domain,
      registrantOrganization:
        readVcardValue(registrant, "org") ?? readVcardValue(registrant, "fn"),
      registrationDate: findEventDate(data, [
        "registration",
        "registered",
      ]),
      expirationDate: findEventDate(data, ["expiration", "expiry"]),
      registrar,
      country: readVcardValue(registrant, "country"),
      isRedacted: detectRedaction(data),
      source,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown RDAP lookup error";

    return {
      domain,
      registrantOrganization: null,
      registrationDate: null,
      expirationDate: null,
      registrar: null,
      country: null,
      isRedacted: false,
      source,
      error: `RDAP lookup failed: ${message}`,
    };
  }
}
