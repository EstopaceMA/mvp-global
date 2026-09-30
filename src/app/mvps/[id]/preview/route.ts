import { countryById } from "@/lib/catalog";
import { getProfileById } from "@/lib/server-directory";
import { createProfilePreview } from "@/lib/profile-preview-image";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const profile = getProfileById((await params).id);
    if (!profile) return new Response("Profile not found", { status: 404 });
    const response = await createProfilePreview(profile, countryById.get(profile.countryId)?.name ?? "Country not listed");
    // Let the route's ISR policy set CDN headers, not ImageResponse's default TTL.
    response.headers.delete("cache-control");
    return response;
}