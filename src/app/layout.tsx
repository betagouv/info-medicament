import Link from "next/link";
import { Metadata } from "next";
import { getHtmlAttributes } from "@codegouvfr/react-dsfr/next-appdir/getHtmlAttributes";
import { DsfrHead } from "@codegouvfr/react-dsfr/next-appdir/DsfrHead";
import { DsfrProvider } from "@codegouvfr/react-dsfr/next-appdir/DsfrProvider";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { fr } from "@codegouvfr/react-dsfr";

import { defaultColorScheme } from "@/app/defaultColorScheme";
import { StartDsfr } from "@/app/StartDsfr";

export const metadata: Metadata = {
  title: "Infomédicament",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = "fr";
  return (
    <html {...getHtmlAttributes({ defaultColorScheme, lang })}>
      <head>
        <StartDsfr />
        <DsfrHead Link={Link} />
      </head>
      <body>
        <DsfrProvider lang={lang}>
          <Header
            brandTop={
              <>
                MINISTÈRE
                <br />
                DU TRAVAIL
                <br />
                DE LA SANTÉ
                <br />
                ET DES SOLIDARITÉS
              </>
            }
            homeLinkProps={{
              href: "/",
              title:
                "Accueil - Ministère du travail de la santé et des solidarités",
            }}
            operatorLogo={{
              alt: "Info Médicament",
              imgUrl: "/logo.svg",
              orientation: "horizontal",
            }}
            serviceTitle="" // hack pour que la tagline soit bien affichée
            serviceTagline="La référence officielle sur les données des médicaments"
          />
          <main className={fr.cx("fr-container", "fr-pt-2w", "fr-pb-8w")}>
            {children}
          </main>
          <Footer accessibility={"non compliant"} />
        </DsfrProvider>
      </body>
    </html>
  );
}
