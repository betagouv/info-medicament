import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { fr } from "@codegouvfr/react-dsfr";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import Pagination from "@codegouvfr/react-dsfr/Pagination";

import { pdbmMySQL } from "@/db/pdbmMySQL";
import liste_CIS_MVP from "@/liste_CIS_MVP.json";
import { MedGroupSpecListList } from "@/components/MedGroupSpecList";
import { groupSpecialites } from "@/displayUtils";

export async function generateStaticParams(): Promise<{ letter: string }[]> {
  return pdbmMySQL
    .selectFrom("Specialite")
    .select(({ fn, val }) =>
      fn<string>("substr", ["SpecDenom01", val(1), val(1)]).as("letter"),
    )
    .where("Specialite.SpecId", "in", liste_CIS_MVP)
    .orderBy("letter")
    .groupBy("letter")
    .execute();
}

const getLetters = unstable_cache(async function () {
  return (await generateStaticParams()).map((r) => r.letter);
});

const getSpecialites = unstable_cache(async function (letter: string) {
  return pdbmMySQL
    .selectFrom("Specialite")
    .selectAll("Specialite")
    .where("SpecDenom01", "like", `${letter}%`)
    .where("Specialite.SpecId", "in", liste_CIS_MVP)
    .execute();
});

export default async function Page({
  params: { letter },
  searchParams,
}: {
  params: { letter: string };
  searchParams: { page?: `${number}` };
}) {
  const page = Number(searchParams.page) || 1;
  const letters = await getLetters();
  const specialites = await getSpecialites(letter);
  const PAGE_LENGTH = 10;

  if (!specialites || !specialites.length) return notFound();

  const medicaments = groupSpecialites(specialites);
  const pageCount =
    Math.trunc(medicaments.length / PAGE_LENGTH) +
    (medicaments.length % PAGE_LENGTH ? 1 : 0);

  return (
    <>
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel="Liste des médicaments"
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1 className={fr.cx("fr-h1", "fr-mb-8w")}>Liste des médicaments</h1>
          <p className={fr.cx("fr-text--lg")}>
            {letters.map((a) => (
              <Fragment key={a}>
                <Link
                  href={`/parcourir/medicaments/${a}`}
                  className={fr.cx(
                    "fr-link",
                    "fr-link--lg",
                    "fr-mr-3w",
                    "fr-mb-3w",
                  )}
                >
                  {a}
                </Link>{" "}
              </Fragment>
            ))}
          </p>
          <MedGroupSpecListList
            items={medicaments.slice(
              (page - 1) * PAGE_LENGTH,
              page * PAGE_LENGTH,
            )}
          />
          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              defaultPage={page}
              getPageLinkProps={(number: number) => ({
                href: `?page=${number}`,
              })}
            />
          )}
        </div>
      </div>
    </>
  );
}
