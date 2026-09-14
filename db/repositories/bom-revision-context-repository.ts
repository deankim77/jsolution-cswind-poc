import {and, eq} from 'drizzle-orm';
import {getDb} from '../index';
import {bomRevisions} from '../schema';

export async function findBomRevision(companyId:string, rootPartId:string, revisionSeq:number) {
  const [row] = await getDb().select().from(bomRevisions).where(and(
    eq(bomRevisions.companyId, companyId),
    eq(bomRevisions.rootPartId, rootPartId),
    eq(bomRevisions.revisionSeq, revisionSeq),
  )).limit(1);
  return row ?? null;
}
