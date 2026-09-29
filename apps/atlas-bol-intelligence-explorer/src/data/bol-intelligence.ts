export const SUFFICIENCY_STATES = [
  "EXECUTION_SUFFICIENT", "PARTIALLY_SUFFICIENT", "DEPENDENCY_BOUND",
  "NOT_EXECUTION_SUFFICIENT", "UNRESOLVED_OR_NA",
] as const;
export type GovernedSufficiencyClassification = (typeof SUFFICIENCY_STATES)[number];
export type AssessmentClassification = GovernedSufficiencyClassification | "NOT_ASSESSED";
export type AssessmentStatus = "ASSESSED" | "NOT_ASSESSED";
export type SupportStatus = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "DEPENDENCY_BOUND" | "UNSUPPORTED";

export interface SourceReference { source_id: string; artifact_name: string; version: string; locator: string; status: AssessmentStatus; claim: string; }
export interface Relationship { relationship_id: string; relationship_type: string; target_field_id: string; statement: string; source_refs: SourceReference[]; }
export interface BusinessRule { rule_id: string; statement: string; conditions: string[]; logic_constraint: string; precedence: number | null; exceptions: string[]; source_refs: SourceReference[]; }
export interface Validation { validation_id: string; statement: string; severity: "ERROR" | "WARNING" | "INFORMATIONAL" | "NOT_ASSESSED"; source_refs: SourceReference[]; }
export interface Dependency { dependency_id: string; dependency_type: string; statement: string; status: "SATISFIED" | "UNSATISFIED" | "NOT_ASSESSED"; source_refs: SourceReference[]; }
export interface Hierarchy { owner_object: string; parent_object: string; cardinality: string; path: string[]; status: AssessmentStatus; }
export interface SufficiencyAssessment { classification: AssessmentClassification; rationale: string; present_components: string[]; missing_components: string[]; }
export interface IdentificationResolutionIntelligence {
  mechanism: string[];
  resolution_states: string[];
  positive_signals: string[];
  competing_concepts: string[];
  association_constraints: string[];
  additional_evidence: string[];
  unresolved_research: { id: string; question: string; policy: string }[];
  consumer_projection: { malkom: string; non_malkom: string; };
}
export interface BolFieldIntelligence { field_id: string; field_number: number; field_name: string; source_classification: string; canonical_object: string; governed_rationale: string; semantic_definition: string; aliases: string[]; hierarchy: Hierarchy; relationships: Relationship[]; rules: BusinessRule[]; applicability_conditions: string[]; validations: Validation[]; precedence: string[]; exceptions: string[]; dependencies: Dependency[]; provenance: SourceReference[]; identification_resolution?: IdentificationResolutionIntelligence; support_status: SupportStatus; gap_flag: boolean; sufficiency: SufficiencyAssessment; version: string; }
export interface BolIntelligencePackage { package_id: string; package_name: string; package_version: string; package_hash: string; hash_algorithm: "SHA-256"; hash_scope: string; lifecycle_status: "EXPERIMENTAL_POC"; generated_at: null; source_scope: string; field_count: 76; assessment_notice: string; semantic_controls: string[]; operational_policies: string[]; fields: BolFieldIntelligence[]; }

type CrosswalkRow = { field_number: number; field_name: string; source_classification: string; canonical_object: string; governed_rationale: string };
const governedCrosswalk: CrosswalkRow[] = [
  {
    "field_number": 1,
    "field_name": "Line Item Hazardous Flag",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods activation condition",
    "governed_rationale": "Domain-valid only when dangerous-goods applicability/relationship conditions are satisfied."
  },
  {
    "field_number": 2,
    "field_name": "Line Item Description",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Consignment Item / Commodity — description",
    "governed_rationale": "Direct semantic family/object exists; preserve object ownership/cardinality."
  },
  {
    "field_number": 3,
    "field_name": "Line Item Piece Count",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Consignment Item / Commodity — package/trade-line quantity",
    "governed_rationale": "Direct semantic family/object exists; preserve object ownership/cardinality."
  },
  {
    "field_number": 4,
    "field_name": "Instruction",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Instruction / Note — scoped content",
    "governed_rationale": "Direct semantic family/object exists; preserve object ownership/cardinality."
  },
  {
    "field_number": 5,
    "field_name": "Reference Number",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Reference / Identifier — value",
    "governed_rationale": "Direct semantic family/object exists; preserve object ownership/cardinality."
  },
  {
    "field_number": 6,
    "field_name": "Reference Number Type Full Name",
    "source_classification": "Client-specific",
    "canonical_object": "Reference / Identifier — type / local representation",
    "governed_rationale": "Canonical family exists; exact local vocabulary/type semantics require client/source binding."
  },
  {
    "field_number": 7,
    "field_name": "Consignee Address 2",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 8,
    "field_name": "Line Item Packaging Type",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Consignment Item / Commodity — package type",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 9,
    "field_name": "Consignee Address 3",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 10,
    "field_name": "Consignee Name",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — name",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 11,
    "field_name": "Reference Number Type",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Reference / Identifier — type / local representation",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 12,
    "field_name": "Bill To Name",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — name",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 13,
    "field_name": "Consignee Address",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 14,
    "field_name": "Consignee Zip",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 15,
    "field_name": "Bill To Address",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 16,
    "field_name": "Bill To Address 2",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 17,
    "field_name": "Line Item Freight Class",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Classification — freight class",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 18,
    "field_name": "Bill To Account Number",
    "source_classification": "Master-data-dependent",
    "canonical_object": "Party[BillTo] — client master identifier binding",
    "governed_rationale": "Meaning depends on client/carrier master identity and binding."
  },
  {
    "field_number": 19,
    "field_name": "Line Item NMFC Sub",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Classification — NMFC/NMFTA family",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 20,
    "field_name": "Bill To Zip",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 21,
    "field_name": "Bill To Address 3",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 22,
    "field_name": "Line Item Weight",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Consignment Item / Commodity — owned weight",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 23,
    "field_name": "Shipper Zip Code",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 24,
    "field_name": "Shipper Name",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — name",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 25,
    "field_name": "Shipper Address",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 26,
    "field_name": "Instruction Type",
    "source_classification": "Client-specific",
    "canonical_object": "Instruction / Note — local type vocabulary binding",
    "governed_rationale": "Canonical family exists; exact local vocabulary/type semantics require client/source binding."
  },
  {
    "field_number": 27,
    "field_name": "Payment Term",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Payment Terms — governed controlled-value family",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 28,
    "field_name": "Bill To Phone Extension",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 29,
    "field_name": "Bill To City",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 30,
    "field_name": "Consignee Phone Extension",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 31,
    "field_name": "Code",
    "source_classification": "Client-specific",
    "canonical_object": "Malkom-form/client binding — exact meaning pending Ops",
    "governed_rationale": "Not identified on BOL; probable client-specific pending Ops."
  },
  {
    "field_number": 32,
    "field_name": "Consignee Account Number",
    "source_classification": "Master-data-dependent",
    "canonical_object": "Party[Consignee] — client master identifier binding",
    "governed_rationale": "Meaning depends on client/carrier master identity and binding."
  },
  {
    "field_number": 33,
    "field_name": "Line Item NMFC",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Classification — NMFC/NMFTA family",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 34,
    "field_name": "Bill To State",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 35,
    "field_name": "Shipper Address 2",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 36,
    "field_name": "Shipper Contact Phone",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 37,
    "field_name": "Shipper Phone Extension",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 38,
    "field_name": "Shipper City",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 39,
    "field_name": "Consignee Phone",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 40,
    "field_name": "Consignee City",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 41,
    "field_name": "Bill To Phone",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 42,
    "field_name": "Shipper State",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 43,
    "field_name": "SHC",
    "source_classification": "Client-specific",
    "canonical_object": "Malkom-form/client binding — exact meaning pending Ops",
    "governed_rationale": "Not identified on BOL; probable client-specific pending Ops."
  },
  {
    "field_number": 44,
    "field_name": "Weight",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Shipment / Consignment — gross/net weight (binding must select semantic owner)",
    "governed_rationale": "Preserve object ownership/cardinality."
  },
  {
    "field_number": 45,
    "field_name": "Emergency Contact Phone",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — emergency response phone",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 46,
    "field_name": "Time Critical Details Date Begin",
    "source_classification": "Conditional domain",
    "canonical_object": "Service / Accessorial / Handling — time-critical family",
    "governed_rationale": "Applicability depends on service/appointment context."
  },
  {
    "field_number": 47,
    "field_name": "Consignee Email",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 48,
    "field_name": "Line Item Hazardous Contract Number",
    "source_classification": "Unsupported SEFL field",
    "canonical_object": "No frozen canonical target",
    "governed_rationale": "Exact label has no supported canonical meaning; source evidence required."
  },
  {
    "field_number": 49,
    "field_name": "Emergency Contact Name",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — responsible person / ERI-provider relationship",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 50,
    "field_name": "Piece Count",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Shipment/Consignment package quantity (must not collapse line-item/handling-unit counts)",
    "governed_rationale": "Preserve ownership/cardinality."
  },
  {
    "field_number": 51,
    "field_name": "Delivery Appointment Date Begin",
    "source_classification": "Conditional domain",
    "canonical_object": "ServiceEventWindow / delivery instruction context",
    "governed_rationale": "Applicability depends on service/appointment context."
  },
  {
    "field_number": 52,
    "field_name": "Delivery Appointment Date End",
    "source_classification": "Conditional domain",
    "canonical_object": "ServiceEventWindow / delivery instruction context",
    "governed_rationale": "Applicability depends on service/appointment context."
  },
  {
    "field_number": 53,
    "field_name": "Bill To Country",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[BillTo] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 54,
    "field_name": "Shipper Code",
    "source_classification": "Master-data-dependent",
    "canonical_object": "Party — client/carrier master identifier binding",
    "governed_rationale": "Meaning depends on client/carrier master identity/binding."
  },
  {
    "field_number": 55,
    "field_name": "Time Critical Details Date End",
    "source_classification": "Conditional domain",
    "canonical_object": "Service / Accessorial / Handling — time-critical family",
    "governed_rationale": "Applicability depends on service/appointment context."
  },
  {
    "field_number": 56,
    "field_name": "Consignee State",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 57,
    "field_name": "BOL Type",
    "source_classification": "Client-specific",
    "canonical_object": "Transport Document / BOL — local lifecycle/type binding",
    "governed_rationale": "Exact local vocabulary/type semantics require binding."
  },
  {
    "field_number": 58,
    "field_name": "Related Value",
    "source_classification": "Client-specific",
    "canonical_object": "Malkom-form/client binding — exact relationship pending Ops",
    "governed_rationale": "Exact related object/value unresolved."
  },
  {
    "field_number": 59,
    "field_name": "Pro Number",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Transport Document / BOL — PRO (distinct reference)",
    "governed_rationale": "PRO remains distinct."
  },
  {
    "field_number": 60,
    "field_name": "Interline SCAC",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party/Carrier identifier / reference",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 61,
    "field_name": "Bill To Email",
    "source_classification": "Derived/contextual",
    "canonical_object": "Party — contact context (not frozen canonical core)",
    "governed_rationale": "Useful context but not frozen canonical core."
  },
  {
    "field_number": 62,
    "field_name": "Time Critical Details Type",
    "source_classification": "Conditional domain",
    "canonical_object": "Service / Accessorial / Handling — time-critical family",
    "governed_rationale": "Applicability depends on service/appointment context."
  },
  {
    "field_number": 63,
    "field_name": "Shipper Country",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 64,
    "field_name": "Shipper Address 3",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Shipper/Consignor] — postal address/addressLines",
    "governed_rationale": "Client-layout representation of canonical addressLines[]."
  },
  {
    "field_number": 65,
    "field_name": "Consignee Country",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Party[Consignee] — postal address/addressLines",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 66,
    "field_name": "Handling Unit Dimensions",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Package / Handling Unit — owned measures",
    "governed_rationale": "Preserve object ownership/cardinality."
  },
  {
    "field_number": 67,
    "field_name": "Line Item Hazardous Technical Name",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — conditional technical name",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 68,
    "field_name": "Line Item Square Yards",
    "source_classification": "Atlas knowledge gap",
    "canonical_object": "Consignment Item / Commodity — area measure + unit (square yard)",
    "governed_rationale": "Legitimate area unit but frozen universe lacks canonical item-level area representation."
  },
  {
    "field_number": 69,
    "field_name": "Line Item Hazardous Packing Group",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — packing group",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 70,
    "field_name": "Line Item Hazardous UNNA Number",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — UN/NA number",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 71,
    "field_name": "Line Item Hazardous Class",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — hazard class/division",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 72,
    "field_name": "Handling Unit Type",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Package / Handling Unit — type",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 73,
    "field_name": "Line Item Hazardous Zone",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — inhalation-hazard zone",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 74,
    "field_name": "Line Item Hazardous Proper Name",
    "source_classification": "Conditional domain",
    "canonical_object": "Dangerous Goods — proper shipping name",
    "governed_rationale": "Conditional on dangerous-goods applicability."
  },
  {
    "field_number": 75,
    "field_name": "Handling Unit Count",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Package / Handling Unit — quantity",
    "governed_rationale": "Direct semantic family/object exists."
  },
  {
    "field_number": 76,
    "field_name": "Handling Unit Line No",
    "source_classification": "Canonical BOL/domain",
    "canonical_object": "Consignment Item / Package hierarchy — shipment-item line/sequence association",
    "governed_rationale": "Identifies item/line structure when multiple items/descriptions occur; not a count."
  }
];

const semanticControls = [
  "Extraction is not semantic resolution: detection, object association, semantic classification, normalization/validation, conditional applicability are separate.",
  "Role precedes identity for party/location.",
  "References carry assigning authority, object relationship, uniqueness scope.",
  "Measures carry semantic owner+unit; gross/net/chargeable/volume not interchangeable.",
  "Handling-unit/package/line-item quantities must not collapse to generic piece count.",
  "Client optionality/mandatory overrides are client bindings, not canonical rewrites.",
  "Hazmat requirements conditionally activated and relationship-aware; flag alone is incomplete.",
  "Source authority/provenance/conflict preserved; unsupported precedence not invented.",
  "Controlled vocabularies canonical; local codes mapped representations.",
  "Address, Address2, Address3 map many-to-one to addressLines[].",
  "Weight vs Line Item Weight have different ownership.",
  "Reference Number/Type/Full Name and PRO are broader reference model; PRO distinct.",
  "Hazard flag, UNNA, proper name, class, packing group, technical name, zone, emergency phone/name form conditional DangerousGoods object.",
  "Time Critical and Delivery Appointment begin/end are scoped event-window semantics."
];
const operationalPolicies = [
  "Missing info: do not fabricate; binding/HITL/exception as required.",
  "Conflicting sources: declared authority policy; retain original evidence/conflict trace.",
  "Low confidence: prevent STP for critical field/object below governed threshold.",
  "Critical FN focus: dangerous goods regulated description; shipment/document identity; handling-unit/line-item association."
];

const sourceClaims: Record<string, SourceReference> = {
  "src-atl-68": { source_id: "src-atl-68", artifact_name: "ATL-68 governed 76-field crosswalk", version: "governed input", locator: "field row", status: "ASSESSED", claim: "Governed field name, classification, canonical target and rationale." },
  "src-ecfr-49-373-101": { source_id: "src-ecfr-49-373-101", artifact_name: "49 CFR 373.101", version: "supplied claim", locator: "regulated US BOL content", status: "ASSESSED", claim: "Establishes regulated US BOL content (consignor, consignee, origin/destination, packages, description, weight/volume/measurement where applicable)." },
  "src-ecfr-49-172-201": { source_id: "src-ecfr-49-172-201", artifact_name: "49 CFR 172.201", version: "supplied claim", locator: "hazardous entry identification", status: "ASSESSED", claim: "Hazardous entry identification." },
  "src-ecfr-49-172-202": { source_id: "src-ecfr-49-172-202", artifact_name: "49 CFR 172.202", version: "supplied claim", locator: "hazmat basic description", status: "ASSESSED", claim: "Hazmat basic description linked object: identification number, proper shipping name, hazard class/division, packing group when applicable." },
  "src-ecfr-49-172-203": { source_id: "src-ecfr-49-172-203", artifact_name: "49 CFR 172.203", version: "supplied claim", locator: "conditional hazmat requirements", status: "ASSESSED", claim: "Technical name and inhalation-zone conditional requirements." },
  "src-ecfr-49-172-604": { source_id: "src-ecfr-49-172-604", artifact_name: "49 CFR 172.604", version: "supplied claim", locator: "emergency response information", status: "ASSESSED", claim: "Emergency phone linked to responsible person/ERI provider identity." },
  "src-dsdc-ebol-2.1": { source_id: "src-dsdc-ebol-2.1", artifact_name: "DSDC eBOL", version: "2.1", locator: "standardized LTL BOL structures/value families", status: "ASSESSED", claim: "Standardized LTL BOL structures/value families." },
  "src-uncefact-transport-logistics": { source_id: "src-uncefact-transport-logistics", artifact_name: "UN/CEFACT Transport & Logistics", version: "supplied claim", locator: "canonical model", status: "ASSESSED", claim: "Canonical object-first semantics." },
  "src-nmfta-nmfc": { source_id: "src-nmfta-nmfc", artifact_name: "NMFTA NMFC", version: "supplied claim", locator: "classification model", status: "ASSESSED", claim: "Classification semantics." },
  "src-nmfta-rule-420": { source_id: "src-nmfta-rule-420", artifact_name: "NMFTA classification guidance / NMFC Rule 420", version: "current researched guidance", locator: "specific vs general description applicability", status: "ASSESSED", claim: "A specific applicable description takes precedence over a more general description when the article/material is embraced by the specific description; complete item context, notes, exceptions and references matter." },
  "src-nmfta-mixed-freight": { source_id: "src-nmfta-mixed-freight", artifact_name: "NMFTA mixed-freight classification guidance", version: "current researched guidance", locator: "mixed freight package/skid/crate", status: "ASSESSED", claim: "Mixed-freight handling requires preserving handling-unit and commodity structure rather than collapsing the shipment into one homogeneous item." },
  "src-nmfta-interpretation": { source_id: "src-nmfta-interpretation", artifact_name: "NMFTA interpretation request requirements", version: "current researched guidance", locator: "additional evidence for commodity interpretation", status: "ASSESSED", claim: "Useful disambiguating evidence includes manufacturer description/model, product literature, function/purpose, package/form of shipment, construction material, SDS where hazardous, food contents and competing NMFC candidates." },
  "src-classit-api-faq": { source_id: "src-classit-api-faq", artifact_name: "NMFTA ClassIT+ API FAQ", version: "current researched guidance", locator: "subitem selection / API limitations", status: "ASSESSED", claim: "ClassIT+ does not currently provide structured subitem-selection logic; API access alone is not complete contextual resolution." },
  "src-gs1-bol": { source_id: "src-gs1-bol", artifact_name: "GS1 US Bill of Lading Guideline R4.0", version: "R4.0", locator: "handling unit / package / commodity / NMFC / class structure", status: "ASSESSED", claim: "Handling Unit, Package, Commodity Description, NMFC and Class are represented as distinct attributes/structures." },
};

const partyFields = new Set([7,9,10,12,13,14,15,16,20,21,23,24,25,29,34,35,38,40,42,53,56,63,64,65]);
const regulatedBolPartyFields = new Set([7,9,10,13,14,23,24,25,35,38,40,42,56,63,64,65]);
const addressFields = new Set([7,9,13,14,15,16,20,21,23,25,29,34,35,38,40,42,53,56,63,64,65]);
const referenceFields = new Set([5,6,11,59,60]);
const measureFields = new Set([22,44,66,68]);
const quantityFields = new Set([3,50,75,76]);
const handlingFields = new Set([3,8,50,66,72,75,76]);
const hazmatFields = new Set([1,45,49,67,69,70,71,73,74]);
const hazmatBasicFields = new Set([69,70,71,74]);
const hazmatConditionalFields = new Set([67,73]);
const eventFields = new Set([46,51,52,55,62]);
const nmfcFields = new Set([17,19,33]);
const derivedFields = new Set([28,30,36,37,39,41,47,61]);
const dependencyFields = new Set([6,18,26,31,32,43,54,57,58]);
const unsupportedFields = new Set([48,68]);
const partialCanonicalFields = new Set([4,27,60]);
const executionHazmatFields = new Set([45,49,67,69,70,71,73,74]);

function refs(...ids: string[]) { return ids.map((id) => sourceClaims[id]).filter((ref): ref is SourceReference => Boolean(ref)); }
function semanticControl(index: number) {
  const value = semanticControls[index];
  if (value === undefined) throw new Error(`Missing governed semantic control ${index}`);
  return value;
}
function operationalPolicy(index: number) {
  const value = operationalPolicies[index];
  if (value === undefined) throw new Error(`Missing governed operational policy ${index}`);
  return value;
}
function controlRule(index: number, sourceRefs: SourceReference[]): BusinessRule {
  const statement = semanticControl(index);
  return { rule_id: `CTRL-${String(index + 1).padStart(2, "0")}`, statement, conditions: [], logic_constraint: statement, precedence: null, exceptions: [], source_refs: sourceRefs };
}
function policyRule(index: number, sourceRefs: SourceReference[]): BusinessRule {
  const statement = operationalPolicy(index);
  return { rule_id: `POL-${String(index + 1).padStart(2, "0")}`, statement, conditions: [], logic_constraint: statement, precedence: null, exceptions: [], source_refs: sourceRefs };
}
function ownerFromTarget(target: string) { const split = target.split(" — "); return split[0] ?? target; }
function fieldProvenance(n: number, classification: string) {
  if (n === 48) return refs("src-atl-68", "src-ecfr-49-172-604");
  if (n === 68) return refs("src-atl-68");
  const ids = ["src-atl-68", "src-uncefact-transport-logistics", "src-dsdc-ebol-2.1"];
  if (regulatedBolPartyFields.has(n) || [2,3,8,22,44,50,66,72,75,76].includes(n)) ids.push("src-ecfr-49-373-101");
  if (hazmatFields.has(n)) ids.push("src-ecfr-49-172-201");
  if (hazmatBasicFields.has(n)) ids.push("src-ecfr-49-172-202");
  if (hazmatConditionalFields.has(n)) ids.push("src-ecfr-49-172-203");
  if ([45,49].includes(n)) ids.push("src-ecfr-49-172-604");
  if (nmfcFields.has(n)) ids.push("src-nmfta-nmfc");
  if (classification === "Client-specific" || classification === "Master-data-dependent" || classification === "Derived/contextual") return refs("src-atl-68", "src-uncefact-transport-logistics");
  return refs(...Array.from(new Set(ids)));
}
function bol002SpecificRefs() {
  return refs(
    "src-atl-68",
    "src-ecfr-49-373-101",
    "src-dsdc-ebol-2.1",
    "src-nmfta-nmfc",
    "src-nmfta-rule-420",
    "src-nmfta-mixed-freight",
    "src-nmfta-interpretation",
    "src-classit-api-faq",
    "src-gs1-bol",
  );
}
function bol002SpecificRules(): BusinessRule[] {
  const r=bol002SpecificRefs();
  return [
    { rule_id:"FIRI-BOL002-R01", statement:"Commodity Description is distinct from handling-unit quantity/type, package quantity/type, weight, NMFC item/subitem, freight class and dangerous-goods attributes; compound evidence must be decomposed before association.", conditions:[], logic_constraint:"SEPARATE_COMPOUND_EVIDENCE_BEFORE_ASSOCIATION", precedence:10, exceptions:[], source_refs:refs("src-gs1-bol","src-nmfta-nmfc") },
    { rule_id:"FIRI-BOL002-R02", statement:"Multiple positively established Commodity Items require separately represented descriptions; preserve source cardinality.", conditions:["More than one Commodity Item is positively established by row/group/object evidence."], logic_constraint:"ONE_DESCRIPTION_ASSOCIATION_PER_ESTABLISHED_COMMODITY_ITEM_WITH_SOURCE_CARDINALITY", precedence:20, exceptions:[], source_refs:refs("src-nmfta-nmfc","src-ecfr-49-373-101") },
    { rule_id:"FIRI-BOL002-R03", statement:"Handling Unit, Package and Commodity Item are distinct concepts. Do not force one-to-one equivalence; permit evidence-supported many-to-many HandlingUnit↔CommodityItem association.", conditions:[], logic_constraint:"NO_HU_PACKAGE_COMMODITY_COLLAPSE", precedence:30, exceptions:[], source_refs:refs("src-gs1-bol","src-nmfta-mixed-freight") },
    { rule_id:"FIRI-BOL002-R04", statement:"When choosing among applicable NMFC descriptions, use the most specific applicable description over a more general applicable description only when the article/material is embraced by that specific provision; evaluate relevant headings, subheadings, notes, exceptions and references.", conditions:["NMFC classification validation is required and multiple candidate provisions exist."], logic_constraint:"SPECIFIC_APPLICABLE_OVER_GENERAL_WITH_FULL_CONTEXT", precedence:40, exceptions:["Do not choose a specific provision that does not actually embrace the article/material."], source_refs:refs("src-nmfta-rule-420") },
    { rule_id:"FIRI-BOL002-R05", statement:"Packaging/form of shipment is separate from Commodity Description but may be material corroborating evidence for commodity identification/classification.", conditions:["Packaging/form evidence is present or an applicable NMFC provision depends on packaging/form."], logic_constraint:"USE_PACKAGING_AS_CONTEXT_NOT_DESCRIPTION_SUBSTITUTE", precedence:50, exceptions:[], source_refs:refs("src-nmfta-interpretation","src-nmfta-nmfc") },
    { rule_id:"FIRI-BOL002-R06", statement:"Preserve the observed commodity-description text even when vague or abbreviated. Semantic field identification does not imply classification sufficiency, and Atlas must not fabricate a more specific description.", conditions:[], logic_constraint:"PRESERVE_OBSERVED_VALUE_NON_FABRICATION", precedence:60, exceptions:[], source_refs:refs("src-atl-68","src-nmfta-interpretation") },
    { rule_id:"FIRI-BOL002-R07", statement:"ClassIT+ is authoritative acquisition/validation infrastructure but API lookup alone is not complete contextual resolution; missing structured subitem-selection logic or omitted references must not be treated as negative evidence.", conditions:["ClassIT+ or equivalent NMFC API is used."], logic_constraint:"API_RESULT_IS_EVIDENCE_NOT_COMPLETE_RESOLUTION", precedence:70, exceptions:[], source_refs:refs("src-classit-api-faq") },
    { rule_id:"FIRI-BOL002-R08", statement:"When evidence is insufficient or conflicting, return the observed value, unresolved reason and pointed additional evidence required; do not guess or silently attach the description to an arbitrary object.", conditions:["Object association, semantic identity or classification sufficiency remains unresolved."], logic_constraint:"FAIL_CLOSED_WITH_POINTED_EVIDENCE_REQUEST", precedence:80, exceptions:[], source_refs:r },
  ];
}
function bol002Relationships(): Relationship[] {
  const r=bol002SpecificRefs();
  return [
    { relationship_id:"REL-BOL002-COMMODITY-OWNER", relationship_type:"OWNED_BY", target_field_id:"canonical:CommodityItem", statement:"Line Item Description belongs to a Commodity Item / Consignment Item object.", source_refs:r },
    { relationship_id:"REL-BOL002-PACKAGE-SEPARATION", relationship_type:"DISTINCT_BUT_CORROBORATING", target_field_id:"BOL-008", statement:"Packaging Type is distinct from description but can corroborate commodity resolution/classification.", source_refs:refs("src-gs1-bol","src-nmfta-interpretation") },
    { relationship_id:"REL-BOL002-NMFC", relationship_type:"VALIDATES_OR_CORROBORATES", target_field_id:"BOL-033", statement:"NMFC item/subitem may validate or contradict a description candidate but does not replace observed description text.", source_refs:refs("src-nmfta-nmfc","src-nmfta-rule-420") },
    { relationship_id:"REL-BOL002-CLASS", relationship_type:"CORROBORATES", target_field_id:"BOL-017", statement:"Freight Class is separate from description and may corroborate classification consistency.", source_refs:refs("src-gs1-bol","src-nmfta-nmfc") },
    { relationship_id:"REL-BOL002-HU-COMMODITY", relationship_type:"MANY_TO_MANY_PERMITTED_IF_EVIDENCED", target_field_id:"canonical:HandlingUnit", statement:"Do not infer 1 Handling Unit = 1 Commodity Item; preserve evidence-supported associations.", source_refs:refs("src-gs1-bol","src-nmfta-mixed-freight") },
  ];
}
function bol002Validations(): Validation[] {
  return [
    { validation_id:"VAL-BOL002-01", statement:"Reject automatic resolution if candidate text is actually package/HU quantity/type, NMFC/subitem, freight class, weight or hazardous-material attribute rather than commodity description.", severity:"ERROR", source_refs:refs("src-gs1-bol","src-nmfta-nmfc") },
    { validation_id:"VAL-BOL002-02", statement:"If multiple Commodity Items are established, verify that descriptions and related attributes remain separately associated rather than collapsed.", severity:"ERROR", source_refs:refs("src-nmfta-nmfc","src-nmfta-mixed-freight") },
    { validation_id:"VAL-BOL002-03", statement:"If classification sufficiency is claimed, verify the applicable NMFC item/subitem context including specific-vs-general applicability and relevant notes/exceptions/references.", severity:"ERROR", source_refs:refs("src-nmfta-rule-420","src-nmfta-nmfc") },
    { validation_id:"VAL-BOL002-04", statement:"A vague or abbreviated observed description may be semantically identified while classification sufficiency remains unresolved; do not upgrade the text without evidence.", severity:"WARNING", source_refs:refs("src-nmfta-interpretation","src-atl-68") },
  ];
}
function bol002IdentificationResolution(): IdentificationResolutionIntelligence {
  return {
    mechanism:["OBSERVE","CANDIDATE","CONTEXT","OBJECT_CARDINALITY","SEPARATE","ASSOCIATE","CORROBORATE","VALIDATE","RESOLVE_ESCALATE"],
    resolution_states:["OBSERVED_DESCRIPTION","SEMANTICALLY_IDENTIFIED_DESCRIPTION","CLASSIFICATION_SUFFICIENT_DESCRIPTION","UNRESOLVED"],
    positive_signals:[
      "Text occupying a commodity/article/description position or group in shipment evidence.",
      "Text associated with a Commodity Item and corroborated by neighboring package quantity/type, weight, NMFC item/subitem, freight class or dangerous-goods evidence.",
      "Article/commodity wording that can be tested against applicable NMFC provisions when classification validation is required."
    ],
    competing_concepts:["Handling Unit quantity/type","Package quantity/type","Line/shipment weight","NMFC item/subitem number","Freight Class","Hazardous-material identification number","Hazard class/division","Packing Group","Hazmat technical name"],
    association_constraints:[
      "Preserve each positively established Commodity Item; do not collapse multiple commodities.",
      "Handling Unit, Package and Commodity Item are distinct concepts.",
      "Permit evidence-supported many-to-many HandlingUnit↔CommodityItem association.",
      "A printed line/sequence number is not a Commodity Item identifier unless its semantic role is established.",
      "Do not identify description solely from fixed page coordinates or one client template."
    ],
    additional_evidence:["manufacturer description/type/model/invoice reference","photos/diagrams/product literature or product link","function/purpose","shipping package type","form of shipment","construction materials","SDS/MSDS when hazardous","food label/contents when applicable","competing NMFC candidate items"],
    unresolved_research:[
      { id:"FIRI-BOL002-U01", question:"Exact universal semantics of Handling Unit Line No and when it is an association key versus sequence.", policy:"Do not equate with Commodity Item identifier without source/client evidence." },
      { id:"FIRI-BOL002-U02", question:"Universal precedence/association semantics for continuation BOLs and external commodity attachments.", policy:"Support additional evidence structurally; do not invent universal precedence." },
    ],
    consumer_projection:{
      malkom:"Project the same canonical rules into Malkom contextualization/rule/HITL/external-lookup configuration; Malkom runtime constructs are not canonical Atlas truth.",
      non_malkom:"A VLM/agent/document-digitization workflow can consume the same identification, association, validation and escalation contract without Malkom queues, schemas or APIs."
    }
  };
}

function fieldRules(n: number, provenance: SourceReference[]) {
  const ruleProvenance = n === 48 ? refs("src-atl-68") : provenance;
  const out: BusinessRule[] = [controlRule(0, ruleProvenance), policyRule(0, ruleProvenance), policyRule(1, ruleProvenance)];
  if (n === 2) out.push(...bol002SpecificRules());
  if (partyFields.has(n)) out.push(controlRule(1, provenance));
  if (referenceFields.has(n)) out.push(controlRule(2, provenance), controlRule(11, provenance));
  if (measureFields.has(n)) out.push(controlRule(3, provenance));
  if (quantityFields.has(n)) out.push(controlRule(4, provenance));
  if (dependencyFields.has(n)) out.push(controlRule(5, provenance), controlRule(8, provenance));
  if (hazmatFields.has(n)) out.push(controlRule(6, provenance), controlRule(12, provenance), policyRule(2, provenance), policyRule(3, provenance));
  if (addressFields.has(n)) out.push(controlRule(9, provenance));
  if ([22,44].includes(n)) out.push(controlRule(10, provenance));
  if (eventFields.has(n)) out.push(controlRule(13, provenance));
  if (handlingFields.has(n)) out.push(policyRule(3, provenance));
  out.push(controlRule(7, ruleProvenance));
  return out;
}
function fieldRelationships(n: number, provenance: SourceReference[]): Relationship[] {
  const result: Relationship[] = [];
  if (n === 2) result.push(...bol002Relationships());
  if (addressFields.has(n)) result.push({ relationship_id: "REL-ADDRESS-LINES", relationship_type: "MANY_TO_ONE_REPRESENTATION", target_field_id: "canonical:addressLines[]", statement: semanticControl(9), source_refs: provenance });
  if ([22,44].includes(n)) result.push({ relationship_id: "REL-WEIGHT-OWNERSHIP", relationship_type: "DISTINCT_SEMANTIC_OWNER", target_field_id: n === 22 ? "BOL-044" : "BOL-022", statement: semanticControl(10), source_refs: provenance });
  if (referenceFields.has(n)) result.push({ relationship_id: "REL-REFERENCE-MODEL", relationship_type: "BROADER_REFERENCE_MODEL", target_field_id: "canonical:Reference", statement: semanticControl(11), source_refs: provenance });
  if (hazmatFields.has(n)) result.push({ relationship_id: "REL-DANGEROUS-GOODS", relationship_type: "CONDITIONAL_OBJECT_MEMBERSHIP", target_field_id: "canonical:DangerousGoods", statement: semanticControl(12), source_refs: provenance });
  if (eventFields.has(n)) result.push({ relationship_id: "REL-EVENT-WINDOW", relationship_type: "SCOPED_EVENT_WINDOW", target_field_id: "canonical:ServiceEventWindow", statement: semanticControl(13), source_refs: provenance });
  if (quantityFields.has(n)) result.push({ relationship_id: "REL-QUANTITY-OWNERSHIP", relationship_type: "DISTINCT_SEMANTIC_OWNER", target_field_id: "canonical:PackageHierarchy", statement: semanticControl(4), source_refs: provenance });
  return result;
}
function dependenciesFor(row: CrosswalkRow, provenance: SourceReference[]): Dependency[] {
  if (!dependencyFields.has(row.field_number)) return [];
  const master = row.source_classification === "Master-data-dependent";
  return [{ dependency_id: master ? "DEP-MASTER-BINDING" : "DEP-CLIENT-BINDING", dependency_type: master ? "MASTER_DATA" : "CLIENT_SOURCE_BINDING", statement: row.governed_rationale, status: "UNSATISFIED", source_refs: provenance }];
}
function classify(row: CrosswalkRow): GovernedSufficiencyClassification {
  const n=row.field_number;
  if (dependencyFields.has(n)) return "DEPENDENCY_BOUND";
  if (unsupportedFields.has(n)) return "NOT_EXECUTION_SUFFICIENT";
  if (derivedFields.has(n) || eventFields.has(n) || n === 1 || partialCanonicalFields.has(n)) return "PARTIALLY_SUFFICIENT";
  if (executionHazmatFields.has(n) || row.source_classification === "Canonical BOL/domain") return "EXECUTION_SUFFICIENT";
  return "UNRESOLVED_OR_NA";
}
function sufficiencyRationale(row: CrosswalkRow, classification: GovernedSufficiencyClassification) {
  if (classification === "DEPENDENCY_BOUND") return row.source_classification === "Master-data-dependent" ? `Dependency-bound: ${row.governed_rationale} Execution requires the declared client/carrier master identity binding.` : `Dependency-bound: ${row.governed_rationale} Execution requires an explicit client/source vocabulary or relationship binding.`;
  if (classification === "NOT_EXECUTION_SUFFICIENT") return row.field_number === 48 ? "Not execution-sufficient: the exact SEFL label remains unsupported until local meaning is reconciled. src-ecfr-49-172-604 is retained only as potentially relevant context and is not asserted as a mapping." : `Not execution-sufficient: ${row.governed_rationale}`;
  if (derivedFields.has(row.field_number)) return `Partially sufficient: ${row.governed_rationale} Supplied evidence does not provide field-level execution logic.`;
  if (eventFields.has(row.field_number)) return `Partially sufficient: ${row.governed_rationale} Exact local coding and applicability are not fully supplied.`;
  if (row.field_number === 1) return "Partially sufficient: hazardous-goods activation is relationship-aware and the flag alone is incomplete; full applicability decision semantics are required.";
  if (row.field_number === 2) return "Execution-sufficient for BOL-002 field identification/resolution after independent QA PASS: field-specific FIRI covers identification, competing-concept separation, CommodityItem cardinality/association, NMFC validation context, ambiguity/non-fabrication, pointed evidence requests and consumer-neutral projection. This is field-level execution sufficiency, not runtime accuracy proof or whole-BOL work readiness.";
  if (partialCanonicalFields.has(row.field_number)) return `Partially sufficient: ${row.governed_rationale} Canonical mapping is present, but the supplied evidence does not fully define field-level execution constraints.`;
  if (executionHazmatFields.has(row.field_number)) return `Execution-sufficient only within stated US hazardous-material applicability: ${row.governed_rationale} Supplied regulatory claims and DangerousGoods relationship controls cover the field.`;
  return `Execution-sufficient for pre-execution semantic resolution: ${row.governed_rationale} Supplied object ownership, relationship controls, and source claims cover the field; this is not runtime accuracy proof.`;
}
function missingComponents(row: CrosswalkRow, classification: GovernedSufficiencyClassification) {
  if (classification === "EXECUTION_SUFFICIENT") return [];
  if (classification === "DEPENDENCY_BOUND") return [row.source_classification === "Master-data-dependent" ? "client/carrier master identity binding" : "client/source vocabulary or relationship binding"];
  if (classification === "NOT_EXECUTION_SUFFICIENT") return [row.field_number === 48 ? "reconciled exact SEFL label meaning" : "canonical item-level area representation", "field-specific execution rule"];
  if (derivedFields.has(row.field_number)) return ["field-level execution logic", "governed validation constraints"];
  if (eventFields.has(row.field_number)) return ["exact local coding", "complete applicability decision semantics"];
  if (row.field_number === 1) return ["complete dangerous-goods activation decision semantics", "linked DangerousGoods object evidence"];
  return ["field-level execution constraints"];
}
function hierarchyFor(row: CrosswalkRow): Hierarchy {
  if (unsupportedFields.has(row.field_number) || [31,43,58].includes(row.field_number)) return { owner_object: row.canonical_object, parent_object: "UNRESOLVED", cardinality: "UNRESOLVED", path: [], status: "NOT_ASSESSED" };
  const owner=ownerFromTarget(row.canonical_object);
  return { owner_object: owner, parent_object: owner, cardinality: row.governed_rationale.includes("cardinality") ? "PRESERVE_SOURCE_CARDINALITY" : "AS_GOVERNED_BY_SOURCE_OBJECT", path: [owner], status: "ASSESSED" };
}
function buildField(row: CrosswalkRow): BolFieldIntelligence {
  const provenance=fieldProvenance(row.field_number,row.source_classification);
  const classification=classify(row);
  const dependencies=dependenciesFor(row,provenance);
  const support: SupportStatus = classification === "EXECUTION_SUFFICIENT" ? "SUPPORTED" : classification === "DEPENDENCY_BOUND" ? "DEPENDENCY_BOUND" : classification === "NOT_EXECUTION_SUFFICIENT" ? "UNSUPPORTED" : "PARTIALLY_SUPPORTED";
  const applicability = row.source_classification === "Conditional domain" ? [row.governed_rationale, ...(hazmatFields.has(row.field_number) ? ["Within stated US hazardous-material applicability."] : [])] : [];
  if (row.field_number === 2) applicability.push("NMFC/classification validation is conditional on the execution purpose and available authoritative knowledge; semantic identification of observed description does not itself establish classification sufficiency.");
  const relationships=fieldRelationships(row.field_number,provenance);
  const rules=fieldRules(row.field_number,provenance);
  const validations=row.field_number === 2 ? bol002Validations() : [];
  const identificationResolution=row.field_number === 2 ? bol002IdentificationResolution() : undefined;
  const effectiveProvenance=row.field_number === 2 ? Array.from(new Map([...provenance,...bol002SpecificRefs()].map((ref)=>[ref.source_id,ref])).values()) : provenance;
  const presentComponents=[
    "governed ATL-68 mapping",
    "governed canonical target statement",
    "governed rationale",
    "source provenance",
    ...(relationships.length ? ["relationship controls"] : []),
    ...(rules.length ? ["applicable semantic controls"] : []),
    ...(row.field_number === 2 ? ["field-specific FIRI identification/resolution contract","field-specific validations","pointed additional-evidence requirements","Malkom + non-Malkom consumer projection"] : []),
  ];
  return { field_id:`BOL-${String(row.field_number).padStart(3,"0")}`, ...row, semantic_definition:row.governed_rationale, aliases:[], hierarchy:hierarchyFor(row), relationships, rules, applicability_conditions:applicability, validations, precedence:[semanticControl(7), operationalPolicy(1)], exceptions:row.field_number === 2 ? ["Do not infer Handling Unit Line No = Commodity Item Number without evidence.","Do not invent universal continuation/attachment precedence."] : [], dependencies, provenance:effectiveProvenance, ...(identificationResolution ? { identification_resolution: identificationResolution } : {}), support_status:support, gap_flag:classification !== "EXECUTION_SUFFICIENT", sufficiency:{ classification, rationale:sufficiencyRationale(row,classification), present_components:presentComponents, missing_components:missingComponents(row,classification) }, version:row.field_number === 2 ? "firi-v1.0-approved-2026.09.28" : "experimental-poc-2026.09.27" };
}

export const bolIntelligencePackage: BolIntelligencePackage = { package_id:"atlas-bol-intelligence-atl-68", package_name:"Atlas BOL Intelligence Package", package_version:"firi-bol002-v1.0-approved-2026.09.28", package_hash:"sha256:a11b6090baab7a02c6ec2e151d09276f664ec131a08e6fcf868ed9a6f39b27bc", hash_algorithm:"SHA-256", hash_scope:"Candidate package changed by ATL-134; deterministic package SHA-256 MUST be recalculated only after independent QA accepts the BOL-002 FIRI payload. The previous ATL-73 package hash identifies the pre-FIRI package and must not be reused.", lifecycle_status:"EXPERIMENTAL_POC", generated_at:null, source_scope:"Governed ATL-68 76-field crosswalk with supplied semantic controls, operational policies and source claims.", field_count:76, assessment_notice:"Pre-execution knowledge sufficiency assessment — not runtime accuracy proof. BOL-002 FIRI v1.0 is independently QA-approved at field level. Whole-BOL/work readiness remains separately governed. Package hash remains pending deterministic post-promotion rehash.", semantic_controls:semanticControls, operational_policies:operationalPolicies, fields:governedCrosswalk.map(buildField) };
export function getBolField(fieldId: string) { return bolIntelligencePackage.fields.find((field) => field.field_id === fieldId); }
export const sufficiencyCounts = Object.fromEntries(SUFFICIENCY_STATES.map((state) => [state, bolIntelligencePackage.fields.filter((field) => field.sufficiency.classification === state).length])) as Record<GovernedSufficiencyClassification, number>;