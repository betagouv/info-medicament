import { getArticles } from "@/data/grist/articles";
import { fr } from "@codegouvfr/react-dsfr";
import { Fragment } from "react";
import Link from "next/link";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";

export const dynamic = "error";

export default async function Page() {
  const articles = await getArticles();

  const categories = Array.from(
    articles
      .reduce((acc, article) => {
        return acc.add(article.category);
      }, new Set<string>())
      .values(),
  );

  return (
    <>
      <Breadcrumb
        segments={[{ label: "Accueil", linkProps: { href: "/" } }]}
        currentPageLabel={"Liste des articles"}
      />
      <div className={fr.cx("fr-grid-row")}>
        <div className={fr.cx("fr-col-md-8")}>
          <h1>Articles</h1>
          {categories.map((category) => (
            <Fragment key={category}>
              <h2 className={fr.cx("fr-h4", "fr-mb-1w")}>{category}</h2>
              <ul className={fr.cx("fr-raw-list", "fr-mb-5w")}>
                {articles
                  .filter(
                    ({ category: articleCategory }) =>
                      articleCategory === category,
                  )
                  .map(({ title, slug }) => (
                    <li key={slug} className={"fr-mb-1w"}>
                      <Link
                        href={`/articles/${slug}`}
                        className={fr.cx(
                          "fr-link",
                          "fr-link--icon-left",
                          "fr-icon-arrow-right-line",
                        )}
                      >
                        {title}
                      </Link>
                    </li>
                  ))}
              </ul>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
