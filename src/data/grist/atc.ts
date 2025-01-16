import "server-cli-only";

import atcOfficialLabels from "@/data/ATC 2024 02 15.json";
import { getGristTableData } from "@/data/grist/index";
import { parse as csvParse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SubstanceNom } from "@/db/pdbmMySQL/types";
import { pdbmMySQL } from "@/db/pdbmMySQL";

export interface ATC1 extends ATC {
  children: ATC[];
}

export interface ATC {
  code: string;
  label: string;
  description: string;
  children?: ATC[];
}

export class ATCError extends Error {
  constructor(code: string) {
    super(`ATC code not found: ${code}`);
  }
}

export const getAtc = async function (): Promise<ATC1[]> {
  const data = await getGristTableData("Table_Niveau_1", [
    "Lettre_1_ATC_1",
    "Libelles_niveau_1",
    "Definition_Classe",
  ]);
  const childrenData = await getGristTableData("Table_Niveau_2", [
    "Libelles_niveau_2",
    "Lettre_2_ATC2",
  ]);

  return Promise.all(
    data.map(async (record) => ({
      code: record.fields.Lettre_1_ATC_1 as string,
      label: record.fields.Libelles_niveau_1 as string,
      description: record.fields.Definition_Classe as string,
      children: await Promise.all(
        childrenData
          .filter((childRecord) =>
            (childRecord.fields.Lettre_2_ATC2 as string).startsWith(
              record.fields.Lettre_1_ATC_1 as string,
            ),
          )
          .map(async (record) =>
            getAtc2(record.fields.Lettre_2_ATC2 as string),
          ),
      ),
    })),
  );
};

export const getAtc1 = async function (code: string): Promise<ATC1> {
  const data = await getGristTableData("Table_Niveau_1", [
    "Lettre_1_ATC_1",
    "Libelles_niveau_1",
    "Definition_Classe",
  ]);
  const record = data.find(
    (record) => record.fields.Lettre_1_ATC_1 === code.slice(0, 1),
  );
  if (!record) {
    throw new ATCError(code.slice(0, 3));
  }

  const childrenData = await getGristTableData("Table_Niveau_2", [
    "Libelles_niveau_2",
    "Lettre_2_ATC2",
  ]);
  const children = await Promise.all(
    childrenData
      .filter((record) =>
        (record.fields.Lettre_2_ATC2 as string).startsWith(code.slice(0, 1)),
      )
      .map(async (record) => getAtc2(record.fields.Lettre_2_ATC2 as string)),
  );

  return {
    code: record.fields.Lettre_1_ATC_1 as string,
    label: record.fields.Libelles_niveau_1 as string,
    description: record.fields.Definition_Classe as string,
    children,
  };
};

export const getAtc2 = async function (code: string): Promise<ATC> {
  const data = await getGristTableData("Table_Niveau_2", [
    "Libelles_niveau_2",
    "Lettre_2_ATC2",
  ]);
  const record = data.find(
    (record) => record.fields.Lettre_2_ATC2 === code.slice(0, 3),
  );

  if (!record) {
    throw new ATCError(code.slice(0, 3));
  }

  const libeleId = record.fields.Libelles_niveau_2;
  const libeleData = await getGristTableData("Intitules_possibles", [
    "Libelles_niveau_2",
    "Definition_sous_classe",
  ]);
  const libeleRecord = libeleData.find((record) => record.id === libeleId);

  if (!libeleRecord) {
    throw new ATCError(code.slice(0, 3));
  }

  return {
    code: record.fields.Lettre_2_ATC2 as string,
    label: libeleRecord.fields.Libelles_niveau_2 as string,
    description: libeleRecord.fields.Definition_sous_classe as string,
    children: Object.keys(atcOfficialLabels)
      .filter((key) => key.startsWith(code))
      .map((key) => ({
        code: key,
        label: (atcOfficialLabels as Record<string, string>)[key],
        description: "",
      })),
  };
};

export const atcData = csvParse(
  readFileSync(
    path.join(process.cwd(), "src", "data", "CIS-ATC_2024-04-07.csv"),
  ),
) as [CIS: string, ATC: string][];

export const getSubstancesByAtc = async function (
  atc2: ATC,
): Promise<SubstanceNom[] | undefined> {
  const CIS = (atc2.children as ATC[])
    .map((atc3) => atcData.filter((row) => row[1] === atc3.code))
    .map((rows) => rows.map((row) => row[0]))
    .flat();

  if (!CIS.length) return;

  return pdbmMySQL
    .selectFrom("Subs_Nom")
    .leftJoin("Composant", "Composant.NomId", "Subs_Nom.NomId")
    .where("Composant.SpecId", "in", CIS)
    .selectAll("Subs_Nom")
    .groupBy(["Subs_Nom.NomId", "Subs_Nom.NomLib", "Subs_Nom.SubsId"])
    .orderBy("Subs_Nom.NomLib")
    .execute();
};

export function getAtcCode(CIS: string) {
  const atc = atcData.find((row) => row[0] === CIS);

  if (!atc) {
    throw new ATCError(CIS);
  }

  return atc[1];
}
