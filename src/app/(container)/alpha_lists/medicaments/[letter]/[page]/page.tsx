import { Fragment } from "react";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { fr } from "@codegouvfr/react-dsfr";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import Pagination from "@codegouvfr/react-dsfr/Pagination";

import { pdbmMySQL } from "@/db/pdbmMySQL";
import { MedGroupSpecListList } from "@/components/MedGroupSpecList";
import { groupSpecialites } from "@/displayUtils";
import AlphabeticNav from "@/components/AlphabeticNav";

export const dynamic = "error";
export const dynamicParams = true;

const getLetters = unstable_cache(async function () {
  return (
    await pdbmMySQL
      .selectFrom("Specialite")
      .select(({ fn, val }) =>
        fn<string>("substr", ["SpecDenom01", val(1), val(1)]).as("letter"),
      )
      .orderBy("letter")
      .groupBy("letter")
      .execute()
  ).map((r) => r.letter);
});

const getSpecialites = unstable_cache(async function (letter: string) {
  return pdbmMySQL
    .selectFrom("Specialite")
    .selectAll("Specialite")
    .where("SpecDenom01", "like", `${letter}%`)
    .orderBy("SpecDenom01")
    .execute();
});

export default async function Page(props: {
  params: Promise<{ letter: string; page: `${number}` }>;
}) {
  const { letter, page } = await props.params;

  if (!Number.isInteger(Number(page))) return notFound();
  const pageNumber = Number(page);
  const letters = await getLetters();
  const specialites = await getSpecialites(letter);
  const PAGE_LENGTH = 10;

  if (!specialites || !specialites.length) return notFound();

  const medicaments = groupSpecialites(specialites);
  const pageCount =
    Math.trunc(medicaments.length / PAGE_LENGTH) +
    (medicaments.length % PAGE_LENGTH ? 1 : 0);

  if (pageNumber < 1 || pageNumber > pageCount) return notFound();

  return (
    <>
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel="Liste des médicaments"
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1 className={fr.cx("fr-h1", "fr-mb-8w")}>Liste des médicaments</h1>
          <AlphabeticNav
            letters={letters}
            url={(letter) => `/medicaments/${letter}/1`}
          />
          <MedGroupSpecListList
            items={medicaments.slice(
              (pageNumber - 1) * PAGE_LENGTH,
              pageNumber * PAGE_LENGTH,
            )}
          />
          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              defaultPage={pageNumber}
              getPageLinkProps={(number: number) => ({
                href: `/medicaments/${letter}/${number}`,
              })}
            />
          )}
        </div>
      </div>
    </>
  );
}
