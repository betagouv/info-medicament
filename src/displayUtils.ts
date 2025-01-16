import {
  ComposantNatureId,
  SpecComposant,
  Specialite,
  SubstanceNom,
} from "@/db/pdbmMySQL/types";

export type MedicamentGroup<T extends Specialite = Specialite> = [string, T[]];

export const formatSpecName = (name: string): string =>
  name
    .split(" ")
    .map((word) =>
      /[A-Z]/.test(word[0]) ? word[0] + word.slice(1).toLowerCase() : word,
    )
    .join(" ");

export function getSpecialiteGroupName(
  specialite: Specialite | string,
): string {
  const specName =
    typeof specialite === "string" ? specialite : specialite.SpecDenom01;
  const regexMatch = specName.match(/^[^0-9,]+/);
  return regexMatch ? regexMatch[0] : specName;
}

export function groupGeneNameToDCI(name: string): string {
  const regexMatch = name.match(/^[^\-]+/);
  return regexMatch ? regexMatch[0].trim() : name;
}

export function groupSpecialites<T extends Specialite>(
  specialites: T[],
): MedicamentGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const specialite of specialites) {
    const groupName = getSpecialiteGroupName(specialite);
    if (groups.has(groupName)) {
      groups.get(groupName)?.push(specialite);
    } else {
      groups.set(groupName, [specialite]);
    }
  }
  return Array.from(groups.entries());
}

export function displaySimpleComposants(
  composants: (SpecComposant & SubstanceNom)[],
): SubstanceNom[] {
  const groups = new Map<number, (SpecComposant & SubstanceNom)[]>();
  for (const composant of composants) {
    if (groups.has(composant.CompNum)) {
      groups.get(composant.CompNum)?.push(composant);
    } else {
      groups.set(composant.CompNum, [composant]);
    }
  }

  return Array.from(groups.values())
    .map((composants: (SpecComposant & SubstanceNom)[]) =>
      composants.filter(
        (composant) => composant.NatuId === ComposantNatureId.Fraction,
      ).length
        ? composants.filter(
            (composant) => composant.NatuId === ComposantNatureId.Fraction,
          )
        : composants,
    )
    .flat();
}

export function displayCompleteComposants(
  composants: (SpecComposant & SubstanceNom)[],
): string {
  const groups = new Map<number, (SpecComposant & SubstanceNom)[]>();
  for (const composant of composants) {
    if (groups.has(composant.CompNum)) {
      groups.get(composant.CompNum)?.push(composant);
    } else {
      groups.set(composant.CompNum, [composant]);
    }
  }

  const displayGroups = Array.from(groups.values()).map(
    (composants: (SpecComposant & SubstanceNom)[]) => {
      const substances = composants.filter(
        (composant) => composant.NatuId === ComposantNatureId.Substance,
      );
      const fractions = composants.filter(
        (composant) => composant.NatuId === ComposantNatureId.Fraction,
      );

      let displayListAs;
      // This is copied from the original PDBM code
      if (
        // If there is many substances or just a substance without therapeutic fraction,
        // we will just display a list of substances
        substances.length - fractions.length >= 1 &&
        fractions.length <= 1
      ) {
        displayListAs = ComposantNatureId.Substance;
      } else if (
        // If there is many fractions in a substance or just a fraction without the substance
        // we will display a list of fractions
        // with maybe the precision "under the form of [name of the substance]"
        fractions.length - substances.length >= 1 &&
        substances.length <= 1
      ) {
        displayListAs = ComposantNatureId.Fraction;
      } else if (fractions.length === substances.length) {
        // Same
        displayListAs = ComposantNatureId.Fraction;
      } else {
        // If there is many substances and fractions, we will display a list of substances
        displayListAs = ComposantNatureId.Substance;
      }

      return { displayListAs, substances, fractions };
    },
  );

  return displayGroups
    .map(({ displayListAs, substances, fractions }) =>
      (displayListAs === ComposantNatureId.Fraction
        ? fractions
        : substances
      ).map(
        (c) =>
          `${c.NomLib} (${c.CompDosage.trim()})${
            (displayListAs === ComposantNatureId.Fraction
              ? substances
              : fractions
            ).length > 0
              ? `${displayListAs === ComposantNatureId.Fraction ? " sous forme de" : "correspondant à"} ${(displayListAs ===
                ComposantNatureId.Fraction
                  ? substances
                  : fractions
                )
                  .map(
                    (c) =>
                      `${c.NomLib}${c.CompDosage ? `(${c.CompDosage})` : ""}`,
                  )
                  .join(" et ")}.`
              : ""
          }`,
      ),
    )
    .flat()
    .join("; ");
}

export function dateShortFormat(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

type NotPromise<T> = T extends Promise<infer U> ? U : T;

export function errorFallback<R extends NotPromise<any>, F>(
  getter: () => R,
  errorClass: any,
  fallback?: F,
): R | F;
export function errorFallback<R extends NotPromise<any>, F>(
  getter: () => Promise<R>,
  errorClass: any,
  fallback?: F,
): Promise<R | F>;
export function errorFallback<R extends NotPromise<any>, F>(
  getter: (() => R) | (() => Promise<R>),
  errorClass: any,
  fallback?: F,
): Promise<R | F> | (R | F) {
  let result: R | Promise<R>;
  try {
    result = getter();
  } catch (e) {
    if (e instanceof errorClass) {
      return fallback as F;
    }
    throw e;
  }

  if (result instanceof Promise) {
    return result.catch((e) => {
      if (e instanceof errorClass) {
        return fallback as F;
      }
      throw e;
    });
  }

  return result;
}
