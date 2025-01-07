import { getSpecialite } from "@/db/utils";
import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import JSZIP from "jszip";
// @ts-ignore
import * as windows1252 from "windows-1252";
import { displaySimpleComposants } from "@/displayUtils";
import {
  ComposantNatureId,
  SpecComposant,
  SubstanceNom,
} from "@/db/pdbmMySQL/types";
import liste_CIS_MVP from "@/liste_CIS_MVP.json";

const dynamic = "error";
const dynamicParams = true;

async function getLeaflet(CIS: string) {
  let zipData = await fs.readFile(
    path.join(process.cwd(), "src", "data", "Notices_RCP_html.zip"),
  );

  const zip = new JSZIP();
  await zip.loadAsync(zipData);
  const data = await zip
    .file(`Notices_RCP_html/${CIS}_notice.htm`)
    ?.async("nodebuffer");

  if (!data) return;

  return windows1252.decode(data);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ CIS: string }> },
) {
  const { CIS } = await params;

  if (!liste_CIS_MVP.includes(CIS)) return notFound();

  const leaflet = await getLeaflet(CIS);

  const { specialite, composants, presentations, delivrance } =
    await getSpecialite(CIS);

  return NextResponse.json({
    CIS: CIS,
    nom: specialite.SpecDenom01,
    web: new URL(`/medicaments/${CIS}`, request.url),
    substances: {
      noms: displaySimpleComposants(composants).map((c) => c.NomLib.trim()),
      link: new URL(
        `/api/substance/${displaySimpleComposants(composants)
          .map((c) => c.NomId.trim())
          .join(",")}`,
        request.url,
      ),
    },

    composants: Object.values(
      composants.reduce(
        (acc: Record<string, (SpecComposant & SubstanceNom)[]>, c) => {
          String(c.CompNum) in acc
            ? acc[String(c.CompNum)]?.push(c)
            : (acc[String(c.CompNum)] = [c]);
          return acc;
        },
        {},
      ),
    ).map((group) =>
      group.map((c) => ({
        nom: c.NomLib.trim(),
        dosage: c.CompDosage.trim(),
        nature:
          c.NatuId === ComposantNatureId.Substance
            ? "Substance active"
            : "Fraction thérapeutique",
      })),
    ),
    presentations: presentations.map((p) => ({
      CIP13: p.Cip13?.trim(),
      nom: p.PresNom01.trim(),
    })),
    delivrance: delivrance,
    notice: leaflet,
  });
}
