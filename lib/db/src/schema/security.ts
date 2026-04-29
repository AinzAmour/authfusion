import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loginAttemptsTable = pgTable("login_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  success: boolean("success").notNull(),
  riskScore: real("risk_score").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const riskEventsTable = pgTable("risk_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull(), // low, medium, high, critical
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const verifiableCredentialsTable = pgTable("verifiable_credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // e.g., 'aadhaar_zkp'
  credentialHash: text("credential_hash").notNull(),
  issuer: text("issuer").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
