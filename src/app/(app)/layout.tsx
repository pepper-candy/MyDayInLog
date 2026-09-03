import { hasNickname } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("daylog_profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasNickname(profile?.nickname)) {
    redirect("/setup");
  }

  return (
    <div className="min-h-dvh w-full bg-[#f7f0e6]">
      <div className="mx-auto flex min-h-dvh w-full max-w-[475px] flex-col">
        {children}
      </div>
    </div>
  );
}
