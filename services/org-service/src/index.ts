/**
 * Plumb Org Service — tenancy, RBAC, project membership.
 *
 * Architectural invariants (master plan §5, §9):
 *  - Every record carries `region` — data residency is non-negotiable.
 *  - (name, region) is unique — same name in different regions is allowed.
 *  - Repository is abstracted so we can swap InMemoryOrgRepository for
 *    PostgresOrgRepository without touching the service.
 */

export type Region = 'us-east' | 'us-west' | 'us-fedramp' | 'eu-west' | 'eu-central' | 'ap-southeast' | 'ap-northeast' | 'ksa';
export type Plan = 'free' | 'pro' | 'enterprise' | 'gov';

const ALL_REGIONS: ReadonlySet<Region> = new Set<Region>([
  'us-east', 'us-west', 'us-fedramp',
  'eu-west', 'eu-central',
  'ap-southeast', 'ap-northeast',
  'ksa',
]);

const ALL_PLANS: ReadonlySet<Plan> = new Set<Plan>(['free', 'pro', 'enterprise', 'gov']);

export interface Org {
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  readonly plan: Plan;
  readonly createdAt: Date;
}

export interface CreateOrgInput {
  readonly name: string;
  readonly region: Region;
  readonly plan: Plan;
}

export interface OrgRepository {
  insert(org: Org): Promise<void>;
  findById(id: string): Promise<Org | null>;
  findByNameAndRegion(name: string, region: Region): Promise<Org | null>;
  list(query?: { region?: Region; limit?: number }): Promise<Org[]>;
}

export class InMemoryOrgRepository implements OrgRepository {
  private readonly byId = new Map<string, Org>();
  private readonly byKey = new Map<string, string>(); // `${region}::${name}` -> id

  async insert(org: Org): Promise<void> {
    if (this.byId.has(org.id)) throw new Error(`org id collision: ${org.id}`);
    this.byId.set(org.id, org);
    this.byKey.set(`${org.region}::${org.name.toLowerCase()}`, org.id);
  }

  async findById(id: string): Promise<Org | null> {
    return this.byId.get(id) ?? null;
  }

  async findByNameAndRegion(name: string, region: Region): Promise<Org | null> {
    const id = this.byKey.get(`${region}::${name.toLowerCase()}`);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async list(query?: { region?: Region; limit?: number }): Promise<Org[]> {
    const all = Array.from(this.byId.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const filtered = query?.region ? all.filter((o) => o.region === query.region) : all;
    return query?.limit ? filtered.slice(0, query.limit) : filtered;
  }
}

export class OrgService {
  private idCounter = 0;

  constructor(private readonly repo: OrgRepository) {}

  async create(input: CreateOrgInput): Promise<Org> {
    validateName(input.name);
    validateRegion(input.region);
    validatePlan(input.plan);

    const existing = await this.repo.findByNameAndRegion(input.name, input.region);
    if (existing) {
      throw new Error(`An organization named "${input.name}" already exists in region "${input.region}".`);
    }

    const org: Org = {
      id: this.nextId(),
      name: input.name.trim(),
      region: input.region,
      plan: input.plan,
      createdAt: new Date(),
    };
    await this.repo.insert(org);
    return org;
  }

  async get(id: string): Promise<Org | null> {
    return this.repo.findById(id);
  }

  async list(query?: { region?: Region; limit?: number }): Promise<Org[]> {
    return this.repo.list(query);
  }

  private nextId(): string {
    this.idCounter += 1;
    return `org_${this.idCounter.toString().padStart(8, '0')}`;
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

function validateRegion(region: string): asserts region is Region {
  if (!ALL_REGIONS.has(region as Region)) {
    const valid = Array.from(ALL_REGIONS).join(', ');
    throw new Error(`unknown region: "${region}". Valid regions: ${valid}`);
  }
}

function validatePlan(plan: string): asserts plan is Plan {
  if (!ALL_PLANS.has(plan as Plan)) {
    const valid = Array.from(ALL_PLANS).join(', ');
    throw new Error(`unknown plan: "${plan}". Valid plans: ${valid}`);
  }
}
