import ClientHeader from "@/components/ClientHeader";
import { getAtc } from "@/data/grist/atc";

export const dynamic = "error";
export const dynamicParams = true;

export default async function InfoMedicamentHeader() {
  const atcs = await getAtc();

  return <ClientHeader atcs={atcs} />;
}
