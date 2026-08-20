/**
 * BimRepository — tenant-scoped storage contract.
 */

import type {
 BimModel,
 BimModelState,
 CreateBimModelInput,
 Deviation,
} from './types.js';

export interface BimRepository {
 // BIM models
 insertBimModel(model: BimModel): Promise<void>;
 findCurrentModel(orgId: string, projectId: string): Promise<BimModel | null>;
 findModelById(orgId: string, id: string): Promise<BimModel | null>;
 listModels(orgId: string, projectId: string): Promise<readonly BimModel[]>;
 updateModelState(orgId: string, id: string, state: BimModelState, totalElements: number | null): Promise<void>;
 markModelCurrent(orgId: string, id: string): Promise<void>;
 softDeleteModel(orgId: string, id: string): Promise<void>;

 // Deviation records
 insertDeviation(deviation: Deviation): Promise<void>;
 listDeviations(orgId: string, modelId: string, captureId: string, thresholdMeters: number): Promise<readonly Deviation[]>;

 nextId(): number;
}

export type Unsubscribe = () => void;

export interface BimEvent {
 readonly type: 'bim.uploaded' | 'bim.validated' | 'bim.ready' | 'bim.aligned' | 'bim.diff_computed' | 'bim.failed';
 readonly modelId: string;
 readonly orgId: string;
 readonly projectId: string;
 readonly occurredAt: Date;
}

export type BimEventSubscriber = (event: BimEvent) => void | Promise<void>;
