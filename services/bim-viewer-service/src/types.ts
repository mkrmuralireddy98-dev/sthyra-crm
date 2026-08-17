/**
 * Sthyra CRM BIM Viewer — domain types.
 */

export const BIM_SCHEMA_VERSIONS = ['IFC4X3'] as const;
export type BimSchemaVersion = (typeof BIM_SCHEMA_VERSIONS)[number];

export const BIM_MODEL_STATES = ['new', 'uploading', 'validating', 'ready', 'aligned', 'diffed', 'failed'] as const;
export type BimModelState = (typeof BIM_MODEL_STATES)[number];

export const BIM_DEVIATION_TYPES = ['orphan', 'extra', 'missing', 'misaligned'] as const;
export type DeviationType = (typeof BIM_DEVIATION_TYPES)[number];

export const BIM_SEVERITIES = ['minor', 'major', 'critical'] as const;
export type BimSeverity = (typeof BIM_SEVERITIES)[number];

export interface Point3D {
 readonly x: number;
 readonly y: number;
 readonly z: number;
}

export interface BimModel {
 readonly id: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly fileName: string;
 readonly schemaVersion: BimSchemaVersion;
 readonly modelHash: string;
 readonly storageKey: string;
 readonly state: BimModelState;
 readonly isCurrent: boolean;
 readonly totalElements: number | null;
 readonly sizeBytes: number;
 readonly createdBy: string;
 readonly createdAt: Date;
 readonly validatedAt: Date | null;
 readonly deletedAt: Date | null;
}

export interface BboxElement {
 readonly elementId: string;
 readonly elementName: string;
 readonly elementType: string;
 readonly min: Point3D;
 readonly max: Point3D;
}

export interface Deviation {
 readonly id: number;
 readonly orgId: string;
 readonly modelId: string;
 readonly captureId: string;
 readonly elementId: string | null;
 readonly deviationType: DeviationType;
 readonly severity: BimSeverity;
 readonly distanceMeters: number;
 readonly description: string | null;
 readonly detectedAt: Date;
}

export interface CreateBimModelInput {
 readonly orgId: string;
 readonly projectId: string;
 readonly fileName: string;
 readonly schemaVersion: BimSchemaVersion;
 readonly modelHash: string;
 readonly storageKey: string;
 readonly sizeBytes: number;
 readonly createdBy: string;
}

export interface ElementLookupResult {
 readonly elementId: string | null;
 readonly elementName: string | null;
 readonly elementType: string | null;
 readonly distance: number;
}
