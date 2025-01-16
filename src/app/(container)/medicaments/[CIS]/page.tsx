import React, { cache } from "react";
import { Metadata, ResolvingMetadata } from "next";
import { notFound } from "next/navigation";
import { fr } from "@codegouvfr/react-dsfr";
import Badge from "@codegouvfr/react-dsfr/Badge";
import Tag from "@codegouvfr/react-dsfr/Tag";
import Accordion from "@codegouvfr/react-dsfr/Accordion";
import { cx } from "@codegouvfr/react-dsfr/tools/cx";
import fs from "node:fs/promises";
import path from "node:path";
import JSZIP from "jszip";
// @ts-ignore
import * as windows1252 from "windows-1252";
import HTMLParser, { HTMLElement } from "node-html-parser";
import DsfrLeafletSection from "./DsfrLeafletSection";
import { isHtmlElement } from "./leafletUtils";
import {
  displayCompleteComposants,
  displaySimpleComposants,
  errorFallback,
  formatSpecName,
  getSpecialiteGroupName,
} from "@/displayUtils";
import Breadcrumb from "@codegouvfr/react-dsfr/Breadcrumb";
import { ATCError, getAtc1, getAtc2, getAtcCode } from "@/data/grist/atc";
import { getSpecialite } from "@/db/utils";
import { PresentationsList } from "@/components/PresentationsList";
import { pdbmMySQL } from "@/db/pdbmMySQL";

export const dynamic = "error";
export const dynamicParams = true;

export async function generateMetadata(
  props: { params: Promise<{ CIS: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { CIS } = await props.params;

  const { specialite } = await getSpecialite(CIS);
  if (!specialite) return notFound();

  const name = formatSpecName(specialite.SpecDenom01);
  return {
    title: `${name} - ${(await parent).title?.absolute}`,
  };
}

/**
 * Returns the sections from leaflets based on a list of CSS selector
 *
 * A leaflet is a long series of p tags at the top level of the body.
 * Most of the time sections are separate <a name="Ann3bDenomination">
 * tags inside one of top level <p> tags
 *
 * @param bodyNode
 * @param sectionsSelectors - list of CSS selectors applied to each <p> tag to find sections limits
 *
 * @example
 ```ts
 * const bodyNode = HTMLParser.parse(`<body>
 *     <p>Content before section 1</p>
 *     <p><a name="Section1"></a>Section 1</p>
 *     <p>Content before section 2</p>
 *     <p><a name="Section2"></a>Section 2</p>
 *     <p>Content of section 2</p>
 *     <p>Content of section 2</p>
 * </body>`).getElementsByTagName("body")[0]
 *
 * const [section1, section2] = getLeafletSections(bodyNode, ["[name=Section1]", "[name=Section2]"])
 * ```
 */
function getLeafletSections(
  bodyNode: HTMLElement,
  sectionsSelectors: Array<string | ((el: HTMLElement) => boolean)>,
) {
  const topLevelPTags = Array.from(bodyNode.childNodes);

  let i = 0;
  const sections = sectionsSelectors.map((selector) => {
    const nextSection = topLevelPTags
      .slice(i)
      .findIndex(
        (el) =>
          isHtmlElement(el) &&
          (typeof selector === "string"
            ? el.querySelector(selector)
            : selector(el)),
      );

    if (nextSection === -1) {
      throw new Error(`No tag found with selector ${selector}`);
    }

    return topLevelPTags.slice(i, (i += nextSection));
  });

  // The first element is the content before the first section class name
  return [...sections, topLevelPTags.slice(i)];
}

const getLeaflet = cache(async (CIS: string) => {
  let zipData = await fs.readFile(
    path.join(process.cwd(), "src", "data", "Notices_RCP_html.zip"),
  );

  const zip = new JSZIP();
  await zip.loadAsync(zipData);
  const data = await zip
    .file(`Notices_RCP_html/${CIS}_notice.htm`)
    ?.async("nodebuffer");

  if (!data) return;

  const html = windows1252.decode(data);
  // Parse the html to get the sections we want
  const dom = HTMLParser.parse(html);

  const majNode = dom.querySelector(".DateNotif");

  if (!majNode) {
    throw new Error(`${CIS} : could not find leaflet update node`);
  }

  let bodyNode = dom.getElementsByTagName("body")[0];

  if (!bodyNode) {
    if (
      dom
        .getElementsByTagName("html")[0]
        .childNodes.find(
          (el) => isHtmlElement(el) && el.classList.contains("AmmAnnexeTitre"),
        )
    ) {
      // body element is not buddy but the content is there at top level
      bodyNode = dom.getElementsByTagName("html")[0];
    } else {
      throw new Error(`${CIS} : could not find body node`);
    }
  }

  const [
    ,
    generalities,
    usage,
    warnings,
    howTo,
    sideEffects,
    storage,
    composition,
  ] = getLeafletSections(bodyNode, [
    // Généralités
    (el) =>
      !!el.querySelector("[name=Ann3bDenomination]") ||
      el.text.trim() === "Dénomination du médicament",
    // À quoi sert-il
    (el) =>
      !!el.querySelector("[name=Ann3bQuestceque]") ||
      el.text.trim().startsWith("1. QU’EST-CE QU’"),
    // Précautions
    (el) =>
      !!el.querySelector("[name=Ann3bInfoNecessaires]") ||
      el.text.trim().startsWith("2. QUELLES SONT LES INFORMATIONS"),
    // Comment le prendre
    (el) =>
      !!el.querySelector("[name=Ann3bCommentPrendre]") ||
      el.text.trim().startsWith("3. COMMENT UTILISER"),
    // Effets indésirables
    "[name=Ann3bEffetsIndesirables]",
    // Conservation
    "[name=Ann3bConservation]",
    // Composition
    "[name=Ann3bEmballage],[name=Ann3bContenu],[name=Ann3bInfoSupp]",
  ]);

  return {
    maj: majNode.innerText,
    generalities,
    usage,
    warnings,
    howTo,
    sideEffects,
    storage,
    composition,
  };
});

export default async function Page(props: {
  params: Promise<{ CIS: string }>;
}) {
  const { CIS } = await props.params;

  const { specialite, composants, presentations, delivrance } =
    await getSpecialite(CIS);

  if (!specialite) return notFound();
  if (!presentations.length) return notFound();

  const leaflet = await getLeaflet(CIS);
  const atcCode = errorFallback(() => getAtcCode(CIS), ATCError, null);
  const [atc1, atc2] = atcCode
    ? [await getAtc1(atcCode), await getAtc2(atcCode)]
    : [null, null];
  const isPrinceps =
    !!(await pdbmMySQL
      .selectFrom("Specialite")
      .select("Specialite.SpecId")
      .where("Specialite.SpecGeneId", "=", CIS)
      .executeTakeFirst()) &&
    !!(await pdbmMySQL
      .selectFrom("GroupeGene")
      .select("GroupeGene.SpecId")
      .where("GroupeGene.SpecId", "=", CIS)
      .executeTakeFirst());

  return (
    <>
      <Breadcrumb
        segments={[
          { label: "Accueil", linkProps: { href: "/" } },
          ...(atc1 && atc2
            ? [
                { label: atc1.label, linkProps: { href: `/atc/${atc1.code}` } },
                { label: atc2.label, linkProps: { href: `/atc/${atc2.code}` } },
              ]
            : []),
          {
            label: displaySimpleComposants(composants)
              .map((s) => s.NomLib.trim())
              .join(", "),
            linkProps: {
              href: `/substances/${displaySimpleComposants(composants)
                .map((s) => s.NomId.trim())
                .join(",")}`,
            },
          },
          {
            label: formatSpecName(getSpecialiteGroupName(specialite)),
            linkProps: {
              href: `/rechercher?s=${formatSpecName(getSpecialiteGroupName(specialite))}`,
            },
          },
        ]}
        currentPageLabel={formatSpecName(specialite.SpecDenom01).replace(
          formatSpecName(getSpecialiteGroupName(specialite)),
          "",
        )}
      />
      <h1 className={fr.cx("fr-h2")}>
        {formatSpecName(specialite.SpecDenom01)}
      </h1>
      <section className={"fr-mb-4w"}>
        <div className={"fr-mb-1w"}>
          <ul className={fr.cx("fr-tags-group", "fr-mb-n1v")}>
            {atc2 && (
              <Tag
                small
                linkProps={{
                  href: `/atc/${atc2.code}`,
                  className: cx("fr-tag--custom-alt-class"),
                }}
              >
                {atc2.label}
              </Tag>
            )}
            <Tag
              small
              linkProps={{
                href: `/substances/${displaySimpleComposants(composants)
                  .map((s) => s.NomId.trim())
                  .join(",")}`,
                className: cx("fr-tag--custom-alt-substance"),
              }}
            >
              {displaySimpleComposants(composants)
                .map((s) => s.NomLib.trim())
                .join(", ")}
            </Tag>
            {isPrinceps && (
              <Tag
                small
                iconId="fr-icon-capsule-fill"
                linkProps={{
                  className: fr.cx("fr-tag--blue-ecume"),
                  href: `/generiques/${CIS}`,
                }}
              >
                Princeps
              </Tag>
            )}
            {specialite.SpecGeneId ? (
              <Tag
                small
                iconId="fr-icon-capsule-fill"
                linkProps={{
                  className: fr.cx("fr-tag--blue-ecume"),
                  href: `/generiques/${specialite.SpecGeneId}`,
                }}
              >
                Générique
              </Tag>
            ) : null}{" "}
            {delivrance.length ? (
              <Tag
                small
                iconId="fr-icon-file-text-fill"
                nativeButtonProps={{
                  className: fr.cx("fr-tag--blue-ecume"),
                }}
              >
                Sur ordonnance
              </Tag>
            ) : null}
          </ul>
        </div>
        <div className={"fr-mb-1w"}>
          <span
            className={["fr-icon--custom-molecule", fr.cx("fr-mr-1w")].join(
              " ",
            )}
          />
          <b>Substance active</b> {displayCompleteComposants(composants)}
        </div>
        <PresentationsList presentations={presentations} />
      </section>
      {leaflet ? (
        <div className={fr.cx("fr-grid-row")}>
          <article
            className={fr.cx("fr-col-12", "fr-col-lg-9", "fr-col-md-10")}
          >
            <div className={fr.cx("fr-mb-4w")}>
              <h1 className={fr.cx("fr-h3", "fr-mb-1w")}>Notice</h1>
              <Badge severity={"info"}>{leaflet.maj}</Badge>
            </div>

            <Accordion label={"Généralités"} titleAs={"h2"}>
              <DsfrLeafletSection data={leaflet.generalities} />
            </Accordion>

            <Accordion label={"A quoi sert-il ?"}>
              <DsfrLeafletSection data={leaflet.usage} />
            </Accordion>

            <Accordion label={"Précautions"}>
              <DsfrLeafletSection data={leaflet.warnings} />
            </Accordion>

            <Accordion label={"Comment le prendre ?"}>
              <DsfrLeafletSection data={leaflet.howTo} />
            </Accordion>

            <Accordion label={"Effets indésirables"}>
              <DsfrLeafletSection data={leaflet.sideEffects} />
            </Accordion>

            <Accordion label={"Conservation"}>
              <DsfrLeafletSection data={leaflet.storage} />
            </Accordion>

            <Accordion label={"Composition"}>
              <DsfrLeafletSection data={leaflet.composition} />
            </Accordion>
          </article>
        </div>
      ) : null}
    </>
  );
}
