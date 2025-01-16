import { pdbmMySQL } from "@/db/pdbmMySQL";
import { notFound } from "next/navigation";
import { SubstanceNom } from "@/db/pdbmMySQL/types";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { fr } from "@codegouvfr/react-dsfr";
import AlphabeticNav from "@/components/AlphabeticNav";
import Link from "next/link";

export const dynamic = "error";
export const dynamicParams = true;

async function getSubstances(letter: string): Promise<SubstanceNom[]> {
  return await pdbmMySQL
    .selectFrom("Subs_Nom")
    .selectAll("Subs_Nom")
    .where("NomLib", "like", `${letter.toLowerCase()}%`)
    .orderBy("Subs_Nom.NomLib")
    .execute();
}

async function getLetters() {
  return (
    await pdbmMySQL
      .selectFrom("Subs_Nom")
      .select(({ fn, val }) =>
        fn<string>("substr", ["Subs_Nom.NomLib", val(1), val(1)]).as("letter"),
      )

      .orderBy("letter")
      .groupBy("letter")
      .execute()
  ).map((r) => r.letter);
}

export default async function Page(props: {
  params: Promise<{ letter: string }>;
}) {
  const { letter } = await props.params;

  const letters = await getLetters();
  const substances = await getSubstances(letter);

  if (!substances || !substances.length) return notFound();

  return (
    <>
      {" "}
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel="Liste des substances"
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1 className={fr.cx("fr-h1", "fr-mb-8w")}>Liste des substances</h1>
          <AlphabeticNav
            letters={letters}
            url={(letter) => `/substances/${letter}`}
          />
          <ul className={fr.cx("fr-raw-list")}>
            {substances.map((substance, i) => (
              <li key={i} className={fr.cx("fr-mb-1v")}>
                <Link
                  href={`/substances/${substance.NomId}`}
                  className={fr.cx("fr-link")}
                >
                  {substance.NomLib}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
