// Shapes and option lists for calls and emails the team logs by hand.
//
// These live outside the server action on purpose: a "use server" module may
// only export async functions, so constants and types shared with client
// components have to sit in a plain module like this one.

export type InteractionKind = "call" | "email";

export interface InteractionOutcome {
  value: string;
  label: string;
  /** True when this outcome means we actually reached the person. */
  reached: boolean;
}

export const CALL_OUTCOMES: readonly InteractionOutcome[] = [
  { value: "spoke", label: "Spoke with them", reached: true },
  { value: "voicemail", label: "Left a voicemail", reached: false },
  { value: "no_answer", label: "No answer", reached: false },
  { value: "callback", label: "They asked to be called back", reached: true },
  { value: "wrong_number", label: "Wrong or bad number", reached: false },
];

export const EMAIL_OUTCOMES: readonly InteractionOutcome[] = [
  { value: "sent", label: "Sent them an email", reached: true },
  { value: "replied", label: "They replied", reached: true },
  { value: "bounced", label: "It bounced", reached: false },
  { value: "no_reply", label: "No reply yet", reached: false },
];

export function outcomeMeta(kind: InteractionKind, value: string): InteractionOutcome | null {
  const list = kind === "call" ? CALL_OUTCOMES : EMAIL_OUTCOMES;
  return list.find((o) => o.value === value) ?? null;
}
