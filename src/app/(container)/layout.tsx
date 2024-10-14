import { fr } from "@codegouvfr/react-dsfr";

export default function ContainerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className={fr.cx("fr-container", "fr-pt-2w", "fr-pb-8w")}>
      {children}
    </main>
  );
}
