import { getGristTableData } from "@/data/grist";
import { fr } from "@codegouvfr/react-dsfr";
import { notFound } from "next/navigation";
import AlphabeticNav from "@/components/AlphabeticNav";
import sanitizeHtml from "sanitize-html";
import slugify from "slugify";

export const dynamic = "error";
export const dynamicParams = true;

async function getDefinitions(firstLetter: string) {
  const definitions = await getGristTableData("Glossaire", [
    "Nom_glossaire",
    "Definition_glossaire",
    "Source",
  ]);

  return definitions
    .filter((definition) =>
      (definition.fields.Nom_glossaire as string).startsWith(firstLetter),
    )
    .map((definition) => definition.fields as { [key: string]: string });
}

async function getLetters() {
  const definitions = await getGristTableData("Glossaire", [
    "Nom_glossaire",
    "Definition_glossaire",
    "Source",
  ]);

  return Array.from(
    new Set(
      definitions
        .map((definition) => (definition.fields.Nom_glossaire as string)[0])
        .filter((letter) => letter && letter.match(/[A-Z]/)),
    ),
  );
}

export default async function Page(props: {
  params: Promise<{ letter: string }>;
}) {
  const { letter } = await props.params;

  const letters = await getLetters();
  if (!letters.includes(letter)) return notFound();

  const definitions = await getDefinitions(letter);

  return (
    <div className={fr.cx("fr-grid-row", "fr-mb-3w")}>
      <div className={fr.cx("fr-col-md-8")}>
        <h1>Glossaire</h1>
        <AlphabeticNav
          letters={letters}
          url={(letter) => `/glossaire/${letter}`}
        />
        {definitions.map((definition) => (
          <>
            <h2
              className={fr.cx("fr-h6", "fr-mt-4w", "fr-mb-1w")}
              id={slugify(definition.Nom_glossaire as string, {
                lower: true,
                strict: true,
              })}
            >
              {definition.Nom_glossaire}
            </h2>
            <div
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  definition.Definition_glossaire as string,
                  {
                    allowedTags: ["p", "br", "ul", "ol", "li"],
                  },
                ),
              }}
            />
          </>
        ))}
      </div>
    </div>
  );
}
