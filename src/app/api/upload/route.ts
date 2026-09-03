import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BLOB_API = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";

function storeIdFromToken(token: string): string {
  const parts = token.split("_");
  return parts[3] ?? "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN is not configured. Add it to .env.local to enable uploads.",
      },
      { status: 500 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "uploads");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const pathname = `${folder}/${user.id}/${Date.now()}-${file.name}`;
  const storeId = storeIdFromToken(token);
  const body = Buffer.from(await file.arrayBuffer());

  const uploadRes = await fetch(
    `${BLOB_API}/?${new URLSearchParams({ pathname })}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "x-api-version": BLOB_API_VERSION,
        "x-vercel-blob-store-id": storeId,
        "x-vercel-blob-access": "public",
        "x-content-type": file.type || "image/jpeg",
      },
      body,
    },
  );

  const uploadData = (await uploadRes.json()) as {
    url?: string;
    error?: { message?: string };
    message?: string;
  };

  if (!uploadRes.ok || !uploadData.url) {
    return NextResponse.json(
      {
        error:
          uploadData.error?.message ||
          uploadData.message ||
          "Avatar upload failed",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: uploadData.url });
}
