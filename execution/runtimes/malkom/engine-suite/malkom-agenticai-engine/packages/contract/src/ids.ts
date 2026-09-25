import { z } from "zod";

/** A machine name: lower case, digits, dashes. Every id in the engine is one. */
export const nameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, "must be lower case letters, digits and dashes, starting with a letter");

/** A field key in the org's own field schemas. Nothing new is invented here. */
export const fieldKeySchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z][A-Za-z0-9_.]*$/, "must be a field key from the org's field schemas");

/** Semantic version. Versions never change after publishing. */
export const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "must be a version like 1.0.0");

/**
 * A plain-language label. Required wherever it appears — a manifest without
 * one is rejected. The UI never shows framework terms; the technical name is
 * one click deeper for whoever wants it.
 */
export const labelSchema = z.string().min(1).max(80);
