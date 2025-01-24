import "server-cli-only";
import { assert, is } from "tsafe";
import { ImageProps } from "next/image";
import imageSize from "image-size";

function matchesFields<F extends string[]>(
  record: Record<string, string | number | boolean | Omit<ImageProps, "alt">>,
  fields: F,
): record is Record<
  F[number],
  string | number | boolean | Omit<ImageProps, "alt">
> {
  return fields.every((key) => key in record);
}

// Cache Grist data to avoid fetching it multiple times.
const gristCache = new Map<string, Promise<any>>();
export const getGristTableData = <F extends string>(
  tableId: string,
  fields: F[],
): Promise<
  {
    id: number;
    fields: Record<F, string | number | boolean | Omit<ImageProps, "alt">>;
  }[]
> => {
  if (!gristCache.has(tableId)) {
    gristCache.set(tableId, uncachedGetGristTableData(tableId, fields));
  }
  return gristCache.get(tableId) as Promise<
    { id: number; fields: Record<F, string | number> }[]
  >;
};

async function uncachedGetGristTableData<F extends string>(
  tableId: string,
  fields: F[],
): Promise<
  {
    id: number;
    fields: Record<F, string | number | boolean | Omit<ImageProps, "alt">>;
  }[]
> {
  const response = await fetch(
    `https://grist.numerique.gouv.fr/api/docs/${process.env.GRIST_DOC_ID}/tables/${tableId}/records?sort=manualSort`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GRIST_API_KEY}`,
        Accept: "application/json",
      },
      cache: "force-cache",
    },
  );

  const body = await response.json();
  if ("error" in body) {
    throw Error(`Grist error: ${body.error}`);
  }

  const data = body.records as {
    id: number;
    fields: Record<
      string,
      string | number | boolean | ["L", number] | Omit<ImageProps, "alt">
    >;
  }[];

  // Replace attachments info by dataurl
  for (const r of data) {
    for (const [key, value] of Object.entries(r.fields)) {
      if (Array.isArray(value) && value[0] === "L") {
        const image = await (
          await (
            await fetch(
              `https://grist.numerique.gouv.fr/api/docs/${process.env.GRIST_DOC_ID}/attachments/${value[1]}/download`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.GRIST_API_KEY}`,
                  Accept: "image/*",
                },
                cache: "force-cache",
              },
            )
          ).blob()
        ).bytes();
        if (!image) {
          throw Error(`Failed to fetch image for field ${key}.`);
        }
        const dimensions = imageSize(image);
        r.fields[key] = {
          src: `data:image/png;base64,${Buffer.from(image).toString("base64")}`,
          width: dimensions.width,
          height: dimensions.height,
        };
      }
    }
  }

  assert(
    is<
      {
        id: number;
        fields: Record<
          string,
          string | number | boolean | Omit<ImageProps, "alt">
        >;
      }[]
    >(data),
  );

  if (!data) {
    throw Error(`No Grist data for table ${tableId}.`);
  }

  if (data.length && !matchesFields(data[0].fields, fields)) {
    throw Error(
      `Grist data for table ${tableId} does not match expected fields.`,
    );
  }

  return data;
}
