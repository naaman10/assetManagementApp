"use client";

import { useState } from "react";
import { AddressFields } from "@/components/clients/client-form";
import {
  FieldMessages,
  FormBanner,
  TextField,
  bannerMessage,
  inputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/form-controls";
import { ApiRequestError, apiRequest, asApiError } from "@/lib/api-client";
import { parseClientBody, type Address, type Client } from "@/lib/clients";
import { parseSiteBody, parseSiteDetail, type Site } from "@/lib/sites";

type ContactOption = {
  id: string;
  name: string;
};

type SiteDraft = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  contactId: string;
};

export function SiteForm({
  clientId,
  site,
  contacts,
  className = "grid gap-5",
  onCancel,
  onMissing,
  onCreated,
  onSaved,
}: {
  clientId: string;
  site?: Site;
  contacts: readonly ContactOption[];
  className?: string;
  onCancel?: () => void;
  onMissing: () => void;
  onCreated?: (client: Client) => void;
  onSaved?: () => void;
}) {
  const creating = !site;
  const options = contactOptions(contacts, site);
  const [name, setName] = useState(site?.name ?? "");
  const [line1, setLine1] = useState(site?.address.line1 ?? "");
  const [line2, setLine2] = useState(site?.address.line2 ?? "");
  const [city, setCity] = useState(site?.address.city ?? "");
  const [county, setCounty] = useState(site?.address.county ?? "");
  const [postcode, setPostcode] = useState(site?.address.postcode ?? "");
  const [country, setCountry] = useState(site?.address.country ?? "");
  const [contactId, setContactId] = useState(site?.contact.id ?? "");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const fieldErrors = error?.fieldErrors ?? {};

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = { name, line1, line2, city, county, postcode, country, contactId };

    if (site) {
      const payload = updatePayload(site, draft);

      if (!payload) {
        setError(new ApiRequestError(400, "No changes were provided."));
        return;
      }

      setPending(true);
      setError(null);

      try {
        parseSiteDetail(
          await apiRequest(`/api/sites/${site.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          }),
        );
        onSaved?.();
      } catch (caught) {
        const apiError = asApiError(caught);

        if (apiError.status === 404) {
          onMissing();
          return;
        }

        setError(apiError);
        setPending(false);
      }

      return;
    }

    setPending(true);
    setError(null);

    try {
      parseSiteBody(
        await apiRequest(`/api/clients/${clientId}/sites`, {
          method: "POST",
          body: JSON.stringify(createBody(draft)),
        }),
      );
      onCreated?.(parseClientBody(await apiRequest(`/api/clients/${clientId}`)));
    } catch (caught) {
      const apiError = asApiError(caught);

      if (apiError.status === 404) {
        onMissing();
        return;
      }

      setError(apiError);
      setPending(false);
    }
  }

  return (
    <form
      className={className}
      method="post"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <FormBanner message={bannerMessage(error?.message ?? null, fieldErrors)} />
      <TextField
        id={site ? `site-${site.id}-name` : "site-name"}
        name="name"
        label="Name"
        required
        maxLength={200}
        value={name}
        disabled={pending}
        messages={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
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
      <ContactSelect
        id={site ? `site-${site.id}-contact` : "site-contact"}
        contacts={options}
        includeBlank={creating}
        value={contactId}
        pending={pending}
        messages={fieldErrors.contactId}
        onChange={setContactId}
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClassName}>
          {pending ? "Saving…" : creating ? "Add site" : "Save"}
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
}

function ContactSelect({
  id,
  contacts,
  includeBlank,
  value,
  pending,
  messages,
  onChange,
}: {
  id: string;
  contacts: readonly ContactOption[];
  includeBlank: boolean;
  value: string;
  pending: boolean;
  messages?: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        Contact
      </label>
      <select
        id={id}
        name="contactId"
        required
        value={value}
        disabled={pending}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {includeBlank ? <option value="">Select a contact</option> : null}
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name}
          </option>
        ))}
      </select>
      <FieldMessages messages={messages} />
    </div>
  );
}

function contactOptions(
  contacts: readonly ContactOption[],
  site: Site | undefined,
): readonly ContactOption[] {
  if (!site || contacts.some((contact) => contact.id === site.contact.id)) {
    return contacts;
  }

  return [{ id: site.contact.id, name: site.contact.name }, ...contacts];
}

function createBody(draft: SiteDraft) {
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

  return {
    name: draft.name.trim(),
    address,
    contactId: draft.contactId,
  };
}

function updatePayload(site: Site, draft: SiteDraft) {
  const payload: {
    name?: string;
    address?: Record<string, string | null>;
    contactId?: string;
  } = {};
  const name = draft.name.trim();

  if (name !== site.name) {
    payload.name = name;
  }

  const address = changedAddress(site.address, draft);

  if (address) {
    payload.address = address;
  }

  if (draft.contactId !== site.contact.id) {
    payload.contactId = draft.contactId;
  }

  return payload.name !== undefined || payload.address || payload.contactId
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

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
