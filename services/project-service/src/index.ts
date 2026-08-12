/**
 * Sthyra CRM Project Service — projects belong to an org, have a status, an address, a start date.
 *
 * Architectural invariants (master plan §5):
 *  - Every project belongs to exactly one org (`org_id` is the tenant scope).
 *  - Project status is a finite state machine: active -> on_hold -> completed | archived.
 *  - The repository is swappable: InMemoryProjectRepository for tests/dev, PostgresProjectRepository for prod.
 */

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

const ALL_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  'active',
  'on_hold',
  'completed',
  'archived',
]);

export interface Project {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly address: string;
  readonly startedAt: Date;
  readonly createdAt: Date;
  readonly archivedAt?: Date;
}

export interface CreateProjectInput {
  readonly orgId: string;
  readonly name: string;
  readonly address: string;
  readonly startedAt: Date;
  readonly status?: ProjectStatus;
}

export interface ListProjectsQuery {
  readonly orgId: string;
  readonly limit?: number;
}

export interface ProjectRepository {
  insert(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
  listByOrg(orgId: string, limit?: number): Promise<Project[]>;
  update(project: Project): Promise<void>;
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly byId = new Map<string, Project>();

  async insert(project: Project): Promise<void> {
    if (this.byId.has(project.id)) throw new Error(`project id collision: ${project.id}`);
    this.byId.set(project.id, project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.byId.get(id) ?? null;
  }

  async listByOrg(orgId: string, limit?: number): Promise<Project[]> {
    const all = Array.from(this.byId.values())
      .filter((p) => p.orgId === orgId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? all.slice(0, limit) : all;
  }

  async update(project: Project): Promise<void> {
    this.byId.set(project.id, project);
  }
}

export class ProjectService {
  private idCounter = 0;

  constructor(private readonly repo: ProjectRepository) {}

  async create(input: CreateProjectInput): Promise<Project> {
    validateOrgId(input.orgId);
    validateName(input.name);
    validateAddress(input.address);
    if (input.status !== undefined) validateStatus(input.status);

    const project: Project = {
      id: this.nextId(),
      orgId: input.orgId,
      name: input.name.trim(),
      status: input.status ?? 'active',
      address: input.address.trim(),
      startedAt: input.startedAt,
      createdAt: new Date(),
    };
    await this.repo.insert(project);
    return project;
  }

  async get(id: string): Promise<Project | null> {
    return this.repo.findById(id);
  }

  async list(query: ListProjectsQuery): Promise<Project[]> {
    return this.repo.listByOrg(query.orgId, query.limit);
  }

  async archive(id: string): Promise<Project> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new Error(`project not found: ${id}`);
    if (existing.status === 'archived') {
      throw new Error(`project ${id} is already archived`);
    }
    const updated: Project = {
      ...existing,
      status: 'archived',
      archivedAt: new Date(),
    };
    await this.repo.update(updated);
    return updated;
  }

  private nextId(): string {
    this.idCounter += 1;
    return `prj_${this.idCounter.toString().padStart(8, '0')}`;
  }
}

function validateOrgId(orgId: string): void {
  if (typeof orgId !== 'string' || orgId.trim().length === 0) {
    throw new Error('orgId must be a non-empty string');
  }
}

function validateName(name: string): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('name must be a non-empty string');
  }
  if (name.trim().length > 200) {
    throw new Error('name must be 200 characters or fewer');
  }
}

function validateAddress(address: string): void {
  if (typeof address !== 'string' || address.trim().length === 0) {
    throw new Error('address must be a non-empty string');
  }
}

function validateStatus(status: string): asserts status is ProjectStatus {
  if (!ALL_STATUSES.has(status as ProjectStatus)) {
    const valid = Array.from(ALL_STATUSES).join(', ');
    throw new Error(`unknown status: "${status}". Valid statuses: ${valid}`);
  }
}
