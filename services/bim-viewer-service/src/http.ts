/**
 * BIM Viewer HTTP layer — 8 routes + SSE.
 */

import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { installRequestIdPlugin, currentRequestId } from "@sthyra-crm/observability";
import { BimService, type BimEvent } from "./service.js";
import { InMemoryEventBus } from "./realtime/index.js";
import { installRealtimePlugin } from "./realtime/sse.js";
import { parseIfc4x3 } from "./ifc-parser.js";

