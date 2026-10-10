"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormBanner,
  PageHeading,
  TextField,
  bannerMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import {
  ApiRequestError,
  apiRequest,
  asApiError,
  type FieldErrors,
} from "@/lib/api-client";
import { parseClientBody, type Address, type Client } from "@/lib/clients";

type ContactDraft = {
  key: string;
  name: string;
  role: string;
  email: string;
  telephone: string;
};

export function ClientForm({
  client,
  onSaved,
  leading,
  embedded = false,
  onCancel,
}: {
  client?: Client;
  onSaved?: (client: Client) => void;
  leading?: React.ReactNode;
  embedded?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const creating = !client;
  const [name, setName] = useState(client?.name ?? "");
  const [reference, setReference] = useState(client?.reference ?? "");
  const [line1, setLine1] = useState(client?.address.line1 ?? "");
  const [line2, setLine2] = useState(client?.address.line2 ?? "");
  const [city, setCity] = useState(client?.address.city ?? "");
  const [county, setCounty] = useState(client?.address.county ?? "");
  const [postcode, setPostcode] = useState(client?.address.postcode ?? "");
  const [country, setCountry] = useState(client?.address.country ?? "");
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { name, reference, line1, line2, city, county, postcode, country };
    const referenceError = referenceErrorMessage(reference);

    if (referenceError) {
      setError(new ApiRequestError(400, "Invalid request", { reference: [referenceError] }));
      return;
    }

    const payload = client
      ? updatePayload(client, draft)
      : createBody(draft, contacts);

    if (!payload) {
      setError(new ApiRequestError(400, "No changes were provided."));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const body = await apiRequest(
        creating ? "/api/clients" : `/api/clients/${client.id}`,
        {
          method: creating ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      const saved = parseClientBody(body);

      if (creating) {
        router.push(`/clients/${saved.id}`);
        return;
      }

      onSaved?.(saved);
      setName(saved.name);
      setReference(saved.reference ?? "");
      setLine1(saved.address.line1);
      setLine2(saved.address.line2 ?? "");
      setCity(saved.address.city);
      setCounty(saved.address.county ?? "");
      setPostcode(saved.address.postcode);
      setCountry(saved.address.country);
    } catch (caught) {
      setError(asApiError(caught));
    } finally {
      setPending(false);
    }
  }

  const fieldErrors = error?.fieldErrors ?? {};

  const form = (
      <form
        className={embedded ? "grid gap-5" : "mt-8 grid gap-5"}
        method="post"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
        <TextField
          id="client-name"
          name="name"
          label="Name"
          autoComplete="organization"
          required
          maxLength={200}
          value={name}
          disabled={pending}
          messages={fieldErrors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <TextField
          id="client-reference"
          name="reference"
          label="Reference"
          required
          maxLength={200}
          value={reference}
          disabled={pending}
          messages={fieldErrors.reference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        <AddressFields
          line1={line1}
          line2={line2}
          city={city}
          county={county}
          postcode={postcode}
          country={country}
          pending={pending}
          fieldErrors={fieldErrors}
          onLine1={setLine1}
          onLine2={setLine2}
          onCity={setCity}
          onCounty={setCounty}
          onPostcode={setPostcode}
          onCountry={setCountry}
        />
        {creating ? (
          <CreateContacts
            contacts={contacts}
            pending={pending}
            fieldErrors={fieldErrors}
            onChange={setContacts}
          />
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClassName}>
            {pending ? "Saving…" : creating ? "Create client" : "Save"}
          </button>
          {onCancel ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <section className="max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6">
      <PageHeading
        title={creating ? "Create client" : "Edit client"}
        action={
          client ? (
            <Link href={`/clients/${client.id}`} className={secondaryButtonClassName}>
              Back
            </Link>
          ) : null
        }
      />
      {leading}
      {form}
    </section>
  );
}

export function AddressFields({
  idPrefix = "address",
  line1,
  line2,
  city,
  county,
  postcode,
  country,
  pending,
  fieldErrors,
  onLine1,
  onLine2,
  onCity,
  onCounty,
  onPostcode,
  onCountry,
}: {
  idPrefix?: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  pending: boolean;
  fieldErrors: FieldErrors;
  onLine1: (value: string) => void;
  onLine2: (value: string) => void;
  onCity: (value: string) => void;
  onCounty: (value: string) => void;
  onPostcode: (value: string) => void;
  onCountry: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="text-sm font-medium">Address</legend>
      {fieldErrors.address ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {fieldErrors.address.join(" ")}
        </p>
      ) : null}
      <TextField
        id={`${idPrefix}-line1`}
        name="line1"
        label="Address line 1"
        autoComplete="address-line1"
        required
        maxLength={200}
        value={line1}
        disabled={pending}
        messages={fieldErrors["address.line1"]}
        onChange={(event) => {
          onLine1(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-line2`}
        name="line2"
        label="Address line 2"
        autoComplete="address-line2"
        maxLength={200}
        value={line2}
        disabled={pending}
        messages={fieldErrors["address.line2"]}
        onChange={(event) => {
          onLine2(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-city`}
        name="city"
        label="City"
        autoComplete="address-level2"
        required
        maxLength={120}
        value={city}
        disabled={pending}
        messages={fieldErrors["address.city"]}
        onChange={(event) => {
          onCity(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-county`}
        name="county"
        label="County"
        autoComplete="address-level1"
        maxLength={200}
        value={county}
        disabled={pending}
        messages={fieldErrors["address.county"]}
        onChange={(event) => {
          onCounty(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-postcode`}
        name="postcode"
        label="Postcode"
        autoComplete="postal-code"
        required
        maxLength={20}
        value={postcode}
        disabled={pending}
        messages={fieldErrors["address.postcode"]}
        onChange={(event) => {
          onPostcode(event.target.value);
        }}
      />
      <TextField
        id={`${idPrefix}-country`}
        name="country"
        label="Country"
        autoComplete="country-name"
        required
        maxLength={120}
        value={country}
        disabled={pending}
        messages={fieldErrors["address.country"]}
        onChange={(event) => {
          onCountry(event.target.value);
        }}
      />
    </fieldset>
  );
}

function CreateContacts({
  contacts,
  pending,
  fieldErrors,
  onChange,
}: {
  contacts: ContactDraft[];
  pending: boolean;
  fieldErrors: FieldErrors;
  onChange: (contacts: ContactDraft[]) => void;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="text-sm font-medium">Contacts</legend>
      {fieldErrors.contacts ? (
        <p className="text-sm leading-6 text-ink" role="alert">
          {fieldErrors.contacts.join(" ")}
        </p>
      ) : null}
      {contacts.map((contact, index) => (
        <div key={contact.key} className="grid gap-5 rounded-card bg-surface p-5 shadow-card">
          <TextField
            id={`contact-${contact.key}-name`}
            label="Name"
            autoComplete="name"
            maxLength={200}
            value={contact.name}
            disabled={pending}
            messages={fieldErrors[`contacts.${index}.name`]}
            onChange={(event) => {
              updateContact(contacts, onChange, contact.key, { name: event.target.value });
            }}
          />
          <TextField
            id={`contact-${contact.key}-role`}
            label="Role"
            autoComplete="organization-title"
            maxLength={80}
            value={contact.role}
            disabled={pending}
            messages={fieldErrors[`contacts.${index}.role`]}
            onChange={(event) => {
              updateContact(contacts, onChange, contact.key, { role: event.target.value });
            }}
          />
          <TextField
            id={`contact-${contact.key}-email`}
            label="Email"
            type="email"
            autoComplete="email"
            value={contact.email}
            disabled={pending}
            messages={fieldErrors[`contacts.${index}.email`]}
            onChange={(event) => {
              updateContact(contacts, onChange, contact.key, { email: event.target.value });
            }}
          />
          <TextField
            id={`contact-${contact.key}-telephone`}
            label="Telephone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            value={contact.telephone}
            disabled={pending}
            messages={fieldErrors[`contacts.${index}.telephone`]}
            onChange={(event) => {
              updateContact(contacts, onChange, contact.key, {
                telephone: event.target.value,
              });
            }}
          />
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={pending}
            onClick={() => {
              onChange(contacts.filter((item) => item.key !== contact.key));
            }}
          >
            Remove contact
          </button>
        </div>
      ))}
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={pending || contacts.length >= 50}
        onClick={() => {
          onChange([
            ...contacts,
            { key: crypto.randomUUID(), name: "", role: "", email: "", telephone: "" },
          ]);
        }}
      >
        Add contact
      </button>
    </fieldset>
  );
}

function updateContact(
  contacts: ContactDraft[],
  onChange: (contacts: ContactDraft[]) => void,
  key: string,
  patch: Partial<ContactDraft>,
) {
  onChange(
    contacts.map((contact) =>
      contact.key === key ? { ...contact, ...patch } : contact,
    ),
  );
}

function createBody(
  draft: {
    name: string;
    reference: string;
    line1: string;
    line2: string;
    city: string;
    county: string;
    postcode: string;
    country: string;
  },
  contacts: ContactDraft[],
) {
  const address: Record<string, string> = {
    line1: draft.line1.trim(),
    city: draft.city.trim(),
    postcode: draft.postcode.trim(),
    country: draft.country.trim(),
  };
  const line2 = draft.line2.trim();
  const county = draft.county.trim();

  if (line2) {
    address.line2 = line2;
  }

  if (county) {
    address.county = county;
  }

  const filled = contacts
    .map((contact) => {
      const entry: Record<string, string> = {};
      const contactName = contact.name.trim();
      const role = contact.role.trim();
      const email = contact.email.trim();
      const telephone = contact.telephone.trim();

      if (contactName) {
        entry.name = contactName;
      }

      if (role) {
        entry.role = role;
      }

      if (email) {
        entry.email = email;
      }

      if (telephone) {
        entry.telephone = telephone;
      }

      return entry;
    })
    .filter((contact) => Object.keys(contact).length > 0);

  return {
    name: draft.name.trim(),
    reference: draft.reference.trim(),
    address,
    ...(filled.length > 0 ? { contacts: filled } : {}),
  };
}

function updatePayload(
  client: Client,
  draft: {
    name: string;
    reference: string;
    line1: string;
    line2: string;
    city: string;
    county: string;
    postcode: string;
    country: string;
  },
) {
  const payload: {
    name?: string;
    reference?: string;
    address?: Record<string, string | null>;
  } = {};
  const name = draft.name.trim();
  const reference = draft.reference.trim();

  if (name !== client.name) {
    payload.name = name;
  }

  if (reference !== client.reference) {
    payload.reference = reference;
  }

  const address = changedAddress(client.address, draft);

  if (address) {
    payload.address = address;
  }

  return payload.name !== undefined ||
    payload.reference !== undefined ||
    payload.address
    ? payload
    : null;
}

function changedAddress(
  current: Address,
  draft: {
    line1: string;
    line2: string;
    city: string;
    county: string;
    postcode: string;
    country: string;
  },
) {
  const next = {
    line1: draft.line1.trim(),
    line2: emptyToNull(draft.line2),
    city: draft.city.trim(),
    county: emptyToNull(draft.county),
    postcode: draft.postcode.trim(),
    country: draft.country.trim(),
  };
  const address: Record<string, string | null> = {};

  if (next.line1 !== current.line1) {
    address.line1 = next.line1;
  }

  if (next.line2 !== current.line2) {
    address.line2 = next.line2;
  }

  if (next.city !== current.city) {
    address.city = next.city;
  }

  if (next.county !== current.county) {
    address.county = next.county;
  }

  if (next.postcode !== current.postcode) {
    address.postcode = next.postcode;
  }

  if (next.country !== current.country) {
    address.country = next.country;
  }

  return Object.keys(address).length > 0 ? address : null;
}

function referenceErrorMessage(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Enter a reference.";
  }

  if (trimmed.length > 200) {
    return "Enter a reference up to 200 characters.";
  }

  return null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
