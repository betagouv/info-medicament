import { pdbmMySQL } from "@/db/pdbmMySQL";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { fr } from "@codegouvfr/react-dsfr";
import AlphabeticNav from "@/components/AlphabeticNav";
import Link from "next/link";
import GenericAccordion from "@/components/GenericAccordion";
import { formatSpecName, groupGeneNameToDCI } from "@/displayUtils";

export const dynamic = "error";
export const dynamicParams = true;

async function getLetters() {
  return (
    await pdbmMySQL
      .selectFrom("GroupeGene")
      .select(({ fn, val }) =>
        fn<string>("substr", ["GroupeGene.LibLong", val(1), val(1)]).as(
          "letter",
        ),
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
  const generics = await pdbmMySQL
    .selectFrom("GroupeGene")
    .select(["GroupeGene.LibLong", "GroupeGene.SpecId"])
    .where("GroupeGene.LibLong", "like", `${letter.toUpperCase()}%`)
    .groupBy(["GroupeGene.LibLong", "GroupeGene.SpecId"])
    .orderBy("GroupeGene.LibLong")
    .execute();

  return (
    <>
      {" "}
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel="Liste des groupes génériques"
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1 className={fr.cx("fr-h1", "fr-mb-8w")}>
            Liste des groupes génériques
          </h1>
          <GenericAccordion className={fr.cx("fr-mb-4w")} />
          <AlphabeticNav
            letters={letters}
            url={(letter) => `/generiques/${letter}`}
          />
          <ul className={fr.cx("fr-raw-list")}>
            {generics.map((g, i) => (
              <li key={i} className={fr.cx("fr-mb-1v")}>
                <Link
                  href={`/generiques/${g.SpecId}`}
                  className={fr.cx("fr-link")}
                >
                  {formatSpecName(groupGeneNameToDCI(g.LibLong))}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
