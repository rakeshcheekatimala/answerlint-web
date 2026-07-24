"use client";

import { useTranslations } from "next-intl";
import {
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import {
  answerLintFeatures,
  featureLabels,
  type AnswerLintFeature,
} from "@/lib/reviews/types";

type FormState = {
  rating: number;
  featuresTried: AnswerLintFeature[];
  experience: string;
  privateImprovementFeedback: string;
  fullName: string;
  showFirstNameOnly: boolean;
  role: string;
  company: string;
  email: string;
  publishingConsent: boolean;
  website: string;
};

const initialState: FormState = {
  rating: 0,
  featuresTried: [],
  experience: "",
  privateImprovementFeedback: "",
  fullName: "",
  showFirstNameOnly: true,
  role: "",
  company: "",
  email: "",
  publishingConsent: false,
  website: "",
};

export function ReviewForm({ locale }: { locale: string }) {
  const t = useTranslations("ReviewForm");
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "submitting" } | { kind: "success" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  function toggleFeature(feature: AnswerLintFeature) {
    setForm((current) => ({
      ...current,
      featuresTried: current.featuresTried.includes(feature)
        ? current.featuresTried.filter((item) => item !== feature)
        : [...current.featuresTried, feature],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locale,
          rating: form.rating,
          experience: form.experience,
          featuresTried: form.featuresTried,
          author: {
            fullName: form.fullName,
            showFirstNameOnly: form.showFirstNameOnly,
            role: form.role,
            company: form.company,
            email: form.email,
          },
          privateImprovementFeedback: form.privateImprovementFeedback,
          publishingConsent: form.publishingConsent,
          website: form.website,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t("genericError"));
      setForm(initialState);
      setStatus({ kind: "success" });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : t("genericError"),
      });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        className="border border-border bg-card px-6 py-12 text-center shadow-soft sm:px-10"
        role="status"
      >
        <div className="mx-auto grid h-10 w-10 place-items-center bg-score-high font-bold text-ink">
          ✓
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold text-ink">
          {t("successTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-ink-muted">{t("successBody")}</p>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          className="mt-8 text-sm font-semibold text-ink underline decoration-border-strong underline-offset-4 hover:decoration-ink"
        >
          {t("submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border border-border bg-card p-5 shadow-soft sm:p-8"
    >
      <fieldset>
        <legend className="text-sm font-semibold text-ink">{t("featuresLabel")}</legend>
        <p className="mt-1 text-sm text-ink-muted">{t("featuresHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {answerLintFeatures.map((feature) => {
            const selected = form.featuresTried.includes(feature);
            return (
              <label
                key={feature}
                className={`cursor-pointer border px-3 py-2 text-sm font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                  selected
                    ? "border-ink bg-ink text-paper"
                    : "border-border bg-paper text-ink hover:border-border-strong"
                }`}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleFeature(feature)}
                />
                {featureLabels[feature]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-8">
        <legend className="text-sm font-semibold text-ink">{t("ratingLabel")}</legend>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className={`cursor-pointer border px-2 py-3 text-center text-sm font-semibold transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                form.rating === rating
                  ? "border-ink bg-ink text-paper"
                  : "border-border bg-paper text-ink hover:border-border-strong"
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name="rating"
                value={rating}
                checked={form.rating === rating}
                onChange={() => setForm({ ...form, rating })}
                required
              />
              {rating}
            </label>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-subtle">
          <span>{t("ratingLow")}</span>
          <span>{t("ratingHigh")}</span>
        </div>
      </fieldset>

      <TextArea
        className="mt-8"
        label={t("experienceLabel")}
        hint={t("experienceHint")}
        value={form.experience}
        onChange={(experience) => setForm({ ...form, experience })}
        minLength={40}
        maxLength={1200}
        required
      />
      <TextArea
        className="mt-6"
        label={t("improvementLabel")}
        hint={t("improvementHint")}
        value={form.privateImprovementFeedback}
        onChange={(privateImprovementFeedback) =>
          setForm({ ...form, privateImprovementFeedback })
        }
        maxLength={1200}
      />

      <div className="mt-8 border-t border-border pt-8">
        <h2 className="font-display text-lg font-semibold text-ink">{t("aboutYou")}</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field
            label={t("nameLabel")}
            value={form.fullName}
            onChange={(fullName) => setForm({ ...form, fullName })}
            autoComplete="name"
            required
          />
          <Field
            label={t("emailLabel")}
            hint={t("emailHint")}
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
            autoComplete="email"
            type="email"
          />
          <Field
            label={t("roleLabel")}
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            autoComplete="organization-title"
          />
          <Field
            label={t("companyLabel")}
            value={form.company}
            onChange={(company) => setForm({ ...form, company })}
            autoComplete="organization"
          />
        </div>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={form.showFirstNameOnly}
          onChange={(event) =>
            setForm({ ...form, showFirstNameOnly: event.target.checked })
          }
          className="mt-0.5 h-4 w-4 accent-ink"
        />
        <span>{t("firstNameOnly")}</span>
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={form.publishingConsent}
          onChange={(event) =>
            setForm({ ...form, publishingConsent: event.target.checked })
          }
          className="mt-0.5 h-4 w-4 accent-ink"
          required
        />
        <span>{t("consent")}</span>
      </label>
      <label className="absolute -left-[10000px]" aria-hidden="true">
        Website
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(event) => setForm({ ...form, website: event.target.value })}
        />
      </label>

      {status.kind === "error" ? (
        <p className="mt-6 border border-score-low/30 bg-score-low/5 px-4 py-3 text-sm text-score-low" role="alert">
          {status.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status.kind === "submitting"}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        {status.kind === "submitting" ? t("submitting") : t("submit")}
      </button>
      <p className="mt-3 text-center text-xs text-ink-subtle">{t("moderationNote")}</p>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={100}
        className="mt-2 min-h-11 w-full border border-border bg-paper px-3 py-2 font-normal text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-ink-subtle">{hint}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  hint,
  value,
  onChange,
  className = "",
  ...props
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return (
    <label className={`block text-sm font-semibold text-ink ${className}`}>
      {label}
      <span className="mt-1 block text-sm font-normal text-ink-muted">{hint}</span>
      <textarea
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-3 w-full resize-y border border-border bg-paper px-3 py-3 font-normal leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
      />
      <span className="mt-1 block text-right text-xs font-normal text-ink-subtle">
        {value.length}/1,200
      </span>
    </label>
  );
}
