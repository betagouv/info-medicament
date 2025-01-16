import type { Kysely } from "kysely";
import { pdbmMySQL } from "@/db/pdbmMySQL";
import { getAtc } from "@/data/grist/atc";

export async function seed(db: Kysely<any>): Promise<void> {
  async function addIndex(table: string, id: string, token: string) {
    await db
      .insertInto("search_index")
      .values(({ fn, val }) => ({
        token: fn("unaccent", [val(token)]),
        table_name: table,
        id,
      }))
      .execute();
  }

  // Get substances from PMDB
  const substances = await pdbmMySQL
    .selectFrom("Subs_Nom")
    .select(["Subs_Nom.NomLib", "Subs_Nom.NomId"])
    .execute();

  await db.transaction().execute(async (db) => {
    await db
      .deleteFrom("search_index")
      .where("table_name", "=", "Subs_Nom")
      .execute();

    // Insert substances into search_index
    for (const substance of substances) {
      await addIndex("Subs_Nom", substance.NomId, substance.NomLib);
    }
  });

  // Get specialities from PMDB
  const specialities = await pdbmMySQL
    .selectFrom("Specialite")
    .select(["SpecDenom01", "SpecId"])
    .execute();

  await db.transaction().execute(async (db) => {
    await db
      .deleteFrom("search_index")
      .where("table_name", "=", "Specialite")
      .execute();

    // Insert specialities into search_index
    for (const specialite of specialities) {
      await addIndex("Specialite", specialite.SpecId, specialite.SpecDenom01);
    }
  });

  // Get pathologies from PMDB
  const pathologies = await pdbmMySQL
    .selectFrom("Patho")
    .select(["Patho.NomPatho", "Patho.codePatho"])
    .execute();

  await db.transaction().execute(async (db) => {
    await db
      .deleteFrom("search_index")
      .where("table_name", "=", "Patho")
      .execute();

    for (const pathology of pathologies) {
      await addIndex("Patho", pathology.codePatho, pathology.NomPatho);
    }
  });

  // Get ATC classes
  const atc = await getAtc();
  await db.transaction().execute(async (db) => {
    await db
      .deleteFrom("search_index")
      .where("table_name", "=", "ATC")
      .execute();

    for (const atcClass of atc) {
      await addIndex("ATC", atcClass.code, atcClass.label);
      for (const atcSubClass of atcClass.children) {
        await addIndex("ATC", atcSubClass.code, atcSubClass.label);
      }
    }
  });

  await pdbmMySQL.destroy();
}
