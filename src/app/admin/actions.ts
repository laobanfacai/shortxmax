"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { parseShanghaiInput } from "@/lib/time";
import { buildEpisodePlan, type IncomingFile } from "@/lib/episode-numbers";

async function guard() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("无权操作");
  return admin;
}

export async function saveSeries(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("请填写标题");
  const slug = slugify(String(formData.get("slug") || title));
  const data = {
    title,
    slug,
    hook: String(formData.get("hook") || "").trim(),
    synopsis: String(formData.get("synopsis") || "").trim(),
    coverUrl: String(formData.get("coverUrl") || "").trim(),
    backdropUrl: String(formData.get("backdropUrl") || "").trim() || null,
    trailerUrl: String(formData.get("trailerUrl") || "").trim() || null,
    genre: String(formData.get("genre") || "ceo-romance"),
    tags: JSON.stringify(
      String(formData.get("tags") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    rating: Number(formData.get("rating") || 4.6),
    ratingCount: Number(formData.get("ratingCount") || 0),
    viewCount: BigInt(Math.max(0, Math.floor(Number(formData.get("viewCount") || 0) || 0))),
    freeEpisodeCount: Number(formData.get("freeEpisodeCount") || 3),
    status: String(formData.get("status") || "draft"),
    isTrending: formData.get("isTrending") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    isNew: formData.get("isNew") === "on",
    releaseYear: Number(formData.get("releaseYear") || new Date().getFullYear()),
    language: String(formData.get("language") || "English"),
    seoTitle: String(formData.get("seoTitle") || "").trim() || null,
    seoDescription: String(formData.get("seoDescription") || "").trim() || null,
    sortOrder: Number(formData.get("sortOrder") || 0),
  };
  const row = id
    ? await prisma.series.update({ where: { id }, data })
    : await prisma.series.create({ data });
  const free = row.freeEpisodeCount;
  await prisma.$transaction(async (tx) => {
    const eps = await tx.episode.findMany({ where: { seriesId: row.id } });
    for (const ep of eps) {
      const shouldFree = ep.number <= free;
      if (ep.isFree !== shouldFree) {
        await tx.episode.update({ where: { id: ep.id }, data: { isFree: shouldFree } });
      }
    }
    await tx.series.update({
      where: { id: row.id },
      data: { totalEpisodes: eps.length },
    });
  });
  revalidatePath("/admin/shows");
  revalidatePath("/");
  revalidatePath("/shows");
  revalidatePath("/genres");
  redirect(`/admin/shows/${row.id}`);
}

export async function deleteSeries(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  await prisma.series.delete({ where: { id } });
  revalidatePath("/admin/shows");
  redirect("/admin/shows");
}

export async function saveEpisode(formData: FormData) {
  await guard();
  const seriesId = String(formData.get("seriesId") || "");
  const id = String(formData.get("id") || "");
  const number = Number(formData.get("number") || 1);
  const data = {
    seriesId,
    number,
    title: String(formData.get("title") || `Episode ${number}`).trim(),
    synopsis: String(formData.get("synopsis") || "").trim() || null,
    durationSec: Number(formData.get("durationSec") || 90),
    videoUrl: String(formData.get("videoUrl") || "").trim() || null,
    thumbnailUrl: String(formData.get("thumbnailUrl") || "").trim() || null,
    isFree: formData.get("isFree") === "on",
    isPublished: formData.get("isPublished") === "on",
    coinPrice: Number(formData.get("coinPrice") || 49),
  };
  if (id) await prisma.episode.update({ where: { id }, data });
  else await prisma.episode.create({ data });
  const count = await prisma.episode.count({ where: { seriesId } });
  await prisma.series.update({ where: { id: seriesId }, data: { totalEpisodes: count } });
  revalidatePath(`/admin/shows/${seriesId}/episodes`);
}

export async function deleteEpisode(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const seriesId = String(formData.get("seriesId") || "");
  await prisma.episode.delete({ where: { id } });
  const count = await prisma.episode.count({ where: { seriesId } });
  await prisma.series.update({ where: { id: seriesId }, data: { totalEpisodes: count } });
  revalidatePath(`/admin/shows/${seriesId}/episodes`);
}

/**
 * Apply a confirmed episode-number plan: compact gaps and/or create newly
 * uploaded episodes. Existing video URLs are preserved; files are not deleted.
 */
export async function applyEpisodePlan(input: {
  seriesId: string;
  compactGaps: boolean;
  incoming?: IncomingFile[];
}): Promise<{ ok: boolean; message: string; assigned?: number[] }> {
  await guard();
  const seriesId = String(input.seriesId || "").trim();
  if (!seriesId) return { ok: false, message: "缺少剧集 ID。" };
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  if (!series) return { ok: false, message: "找不到该剧。" };

  const incoming: IncomingFile[] = (input.incoming || []).map((row) => ({
    filename: String(row.filename || "").trim(),
    videoUrl: String(row.videoUrl || "").trim() || null,
    title: row.title ? String(row.title).trim() : undefined,
    durationSec: Number(row.durationSec || 0) || undefined,
  }));
  if (incoming.some((row) => !row.filename || !row.videoUrl)) {
    return { ok: false, message: "新分集需要有效的文件名和视频地址。" };
  }

  const plan = buildEpisodePlan({
    existing: series.episodes.map((ep) => ({
      id: ep.id,
      number: ep.number,
      title: ep.title,
      videoUrl: ep.videoUrl,
      synopsis: ep.synopsis,
      durationSec: ep.durationSec,
      thumbnailUrl: ep.thumbnailUrl,
      isFree: ep.isFree,
      isPublished: ep.isPublished,
      coinPrice: ep.coinPrice,
    })),
    incoming,
    compactGaps: Boolean(input.compactGaps),
  });

  const existingIds = new Set(series.episodes.map((ep) => ep.id));
  const plannedExisting = plan.items.filter((it) => it.kind === "existing");
  if (plannedExisting.length !== existingIds.size || plannedExisting.some((it) => !it.id || !existingIds.has(it.id))) {
    return { ok: false, message: "预览与当前分集不一致，请刷新后重试。" };
  }
  const assigned = plan.items.map((it) => it.assignedNumber);
  if (new Set(assigned).size !== assigned.length || assigned.some((n) => n < 1)) {
    return { ok: false, message: "集号映射无效。" };
  }
  if (!plan.willChange) {
    return { ok: true, message: "集号已是连续的，无需改动。", assigned };
  }

  const TEMP = 1_000_000;
  const freeCount = series.freeEpisodeCount;
  await prisma.$transaction(async (tx) => {
    for (const item of plannedExisting) {
      await tx.episode.update({
        where: { id: item.id! },
        data: { number: TEMP + item.assignedNumber },
      });
    }
    for (const item of plannedExisting) {
      await tx.episode.update({
        where: { id: item.id! },
        data: {
          number: item.assignedNumber,
          title: item.title,
          isFree: item.assignedNumber <= freeCount,
        },
      });
    }
    for (const item of plan.items.filter((it) => it.kind === "new")) {
      await tx.episode.create({
        data: {
          seriesId,
          number: item.assignedNumber,
          title: item.title,
          synopsis: item.synopsis || null,
          durationSec: item.durationSec || 90,
          videoUrl: item.videoUrl || null,
          thumbnailUrl: item.thumbnailUrl || null,
          isFree: item.assignedNumber <= freeCount,
          isPublished: item.isPublished ?? true,
          coinPrice: item.coinPrice || 49,
        },
      });
    }
    const count = await tx.episode.count({ where: { seriesId } });
    await tx.series.update({ where: { id: seriesId }, data: { totalEpisodes: count } });
  });

  revalidatePath(`/admin/shows/${seriesId}/episodes`);
  revalidatePath(`/admin/shows/${seriesId}`);
  revalidatePath(`/shows/${series.slug}`);
  revalidatePath(`/watch/${series.slug}`);
  revalidatePath("/shows");
  return {
    ok: true,
    message: input.compactGaps && plan.hasGaps
      ? `已按预览写入，缺集已前移补齐，共 ${plan.items.length} 集。`
      : `已按预览写入，共 ${plan.items.length} 集。`,
    assigned,
  };
}

export async function savePlan(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").trim(),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "plan")),
    period: String(formData.get("period") || "monthly"),
    priceCents: Math.round(Number(formData.get("price") || 0) * 100),
    currency: String(formData.get("currency") || "USD"),
    perks: JSON.stringify(
      String(formData.get("perks") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    badge: String(formData.get("badge") || "").trim() || null,
    isPopular: formData.get("isPopular") === "on",
    isEnabled: formData.get("isEnabled") === "on",
    stripePriceId: String(formData.get("stripePriceId") || "").trim() || null,
    sortOrder: Number(formData.get("sortOrder") || 0),
  };
  if (id) await prisma.plan.update({ where: { id }, data });
  else await prisma.plan.create({ data });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

export async function saveCoinPack(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const data = {
    name: String(formData.get("name") || "").trim(),
    coins: Number(formData.get("coins") || 0),
    bonusCoins: Number(formData.get("bonusCoins") || 0),
    priceCents: Math.round(Number(formData.get("price") || 0) * 100),
    currency: String(formData.get("currency") || "USD"),
    isEnabled: formData.get("isEnabled") === "on",
    sortOrder: Number(formData.get("sortOrder") || 0),
  };
  if (id) await prisma.coinPackage.update({ where: { id }, data });
  else await prisma.coinPackage.create({ data });
  revalidatePath("/admin/plans");
  revalidatePath("/admin/coins");
  revalidatePath("/pricing");
}

export async function saveSettings(formData: FormData) {
  await guard();
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {
      siteName: String(formData.get("siteName") || "ShortXMax"),
      tagline: String(formData.get("tagline") || ""),
      seoTitle: String(formData.get("seoTitle") || ""),
      seoDescription: String(formData.get("seoDescription") || ""),
      ogImage: String(formData.get("ogImage") || "/og.jpg"),
      supportEmail: String(formData.get("supportEmail") || ""),
      socialLinks: JSON.stringify({
        twitter: String(formData.get("twitter") || ""),
        instagram: String(formData.get("instagram") || ""),
        youtube: String(formData.get("youtube") || ""),
        tiktok: String(formData.get("tiktok") || ""),
      }),
      metaPixelId: String(formData.get("metaPixelId") || "").trim(),
      tiktokPixelId: String(formData.get("tiktokPixelId") || "").trim(),
      googleTagId: String(formData.get("googleTagId") || "").trim(),
      googleAdsId: String(formData.get("googleAdsId") || "").trim(),
      googleAdsLabel: String(formData.get("googleAdsLabel") || "").trim(),
    },
    create: { id: "default" },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

export async function savePayments(formData: FormData) {
  await guard();
  const keep = (name: string, fallback: string) => {
    const v = String(formData.get(name) || "").trim();
    if (!v || v === "••••KEEP••••") return fallback;
    return v;
  };
  const current = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {
      demoPayEnabled: formData.get("demoPayEnabled") === "on",
      stripeEnabled: formData.get("stripeEnabled") === "on",
      stripeMode: String(formData.get("stripeMode") || "test") === "live" ? "live" : "test",
      stripePublicKey: keep("stripePublicKey", current?.stripePublicKey || ""),
      stripeSecretKey: keep("stripeSecretKey", current?.stripeSecretKey || ""),
      stripeWebhookSec: keep("stripeWebhookSec", current?.stripeWebhookSec || ""),
      stripeLivePublicKey: keep("stripeLivePublicKey", current?.stripeLivePublicKey || ""),
      stripeLiveSecretKey: keep("stripeLiveSecretKey", current?.stripeLiveSecretKey || ""),
      stripeLiveWebhookSec: keep("stripeLiveWebhookSec", current?.stripeLiveWebhookSec || ""),
      paypalEnabled: formData.get("paypalEnabled") === "on",
      paypalMode: String(formData.get("paypalMode") || "sandbox") === "live" ? "live" : "sandbox",
      paypalClientId: keep("paypalClientId", current?.paypalClientId || ""),
      paypalSecret: keep("paypalSecret", current?.paypalSecret || ""),
      paypalWebhookId: keep("paypalWebhookId", current?.paypalWebhookId || ""),
    },
    create: { id: "default" },
  });
  const methods = await prisma.paymentMethod.findMany();
  for (const m of methods) {
    await prisma.paymentMethod.update({
      where: { id: m.id },
      data: { isEnabled: formData.get(`method_${m.id}`) === "on" },
    });
  }
  revalidatePath("/admin/payments");
  revalidatePath("/pricing");
  revalidatePath("/go");
}

export async function toggleUserStatus(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === "admin") return;
  await prisma.user.update({
    where: { id },
    data: { status: user.status === "banned" ? "active" : "banned", sessionVersion: { increment: 1 } },
  });
  const actor=await requireAdmin();
  if(actor) await prisma.adminAudit.create({data:{actorId:actor.id,userId:id,action:"user_update",detail:"账号状态或金币更新"}});
  revalidatePath("/admin/users");
}

export async function refundOrder(formData: FormData) {
  const actor = await guard();
  const id = String(formData.get("id") || "");
  await prisma.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || order.status !== "paid") return;
    // External processors require an actual refund in their own dashboard first. Never pretend to refund funds.
    if (order.provider !== "demo") throw new Error("真实支付请先在支付平台退款，再人工核对权益；此按钮仅用于 Demo 订单。");
    await tx.order.update({ where: { id }, data: { status: "refunded" } });
    await tx.subscription.updateMany({ where: { orderId: id }, data: { status: "revoked", endsAt: new Date() } });
    if (order.coinPackageId) { const pack=await tx.coinPackage.findUnique({where:{id:order.coinPackageId}});const user=await tx.user.findUniqueOrThrow({where:{id:order.userId}});if(pack)await tx.user.update({where:{id:user.id},data:{coins:Math.max(0,user.coins-pack.coins-pack.bonusCoins)}}); }
    await tx.adminAudit.create({data:{actorId:actor.id,userId:order.userId,action:"demo_refund",detail:`撤销 Demo 订单 ${id} 的站内权益（未执行外部退款）`}});
  });
  revalidatePath("/admin/orders");revalidatePath("/account");
}

export async function savePromo(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const planIds = formData.getAll("planId").map(String);
  const coinIds = formData.getAll("coinId").map(String);
  const planPrices = planIds.map((pid) => ({
    id: pid,
    promoCents: Math.round(Number(formData.get(`planPrice_${pid}`) || 0) * 100),
  }));
  const coinPrices = coinIds.map((cid) => ({
    id: cid,
    promoCents: Math.round(Number(formData.get(`coinPrice_${cid}`) || 0) * 100),
  }));
  const data = {
    name: String(formData.get("name") || "").trim() || "未命名活动",
    badge: String(formData.get("badge") || "").trim(),
    headline: String(formData.get("headline") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    planPrices: JSON.stringify(planPrices),
    coinPrices: JSON.stringify(coinPrices),
    startsAt: parseShanghaiInput(String(formData.get("startsAt") || "")),
    endsAt: parseShanghaiInput(String(formData.get("endsAt") || "")),
    showCountdown: formData.get("showCountdown") === "on",
    isEnabled: formData.get("isEnabled") === "on",
  };
  if (id) await prisma.promoCampaign.update({ where: { id }, data });
  else await prisma.promoCampaign.create({ data });
  revalidatePath("/admin/promos");
  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/go");
}

export async function deletePromo(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  await prisma.promoCampaign.delete({ where: { id } });
  revalidatePath("/admin/promos");
  revalidatePath("/");
  revalidatePath("/pricing");
}

export async function saveStorageMode(formData: FormData) {
  await guard();
  const mode = "r2studio";
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: { storageMode: mode },
    create: { id: "default", storageMode: mode },
  });
  revalidatePath("/admin/storage");
}

export async function saveStorageEndpoint(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const current = id ? await prisma.storageEndpoint.findUnique({ where: { id } }) : null;
  const keep = (name: string, fallback: string) => {
    const v = String(formData.get(name) || "").trim();
    if (!v || v === "••••KEEP••••") return fallback;
    return v;
  };
  const data = {
    label: String(formData.get("label") || "").trim() || "R2 节点",
    provider: "r2",
    accountId: String(formData.get("accountId") || "").trim(),
    accessKey: keep("accessKey", current?.accessKey || ""),
    secretKey: keep("secretKey", current?.secretKey || ""),
    bucket: String(formData.get("bucket") || "").trim(),
    endpoint: String(formData.get("endpoint") || "").trim(),
    region: String(formData.get("region") || "auto").trim() || "auto",
    publicBaseUrl: String(formData.get("publicBaseUrl") || "").trim(),
    weight: Math.max(1, Number(formData.get("weight") || 1)),
    isEnabled: formData.get("isEnabled") === "on",
    sortOrder: Number(formData.get("sortOrder") || 0),
  };
  if (id) await prisma.storageEndpoint.update({ where: { id }, data });
  else await prisma.storageEndpoint.create({ data });
  revalidatePath("/admin/storage");
}

export async function deleteStorageEndpoint(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  await prisma.storageEndpoint.delete({ where: { id } });
  revalidatePath("/admin/storage");
}

export async function toggleSeriesFlag(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const field = String(formData.get("field") || "");
  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) return;
  if (field === "status") {
    await prisma.series.update({
      where: { id },
      data: { status: series.status === "published" ? "draft" : "published" },
    });
  } else if (field === "isFeatured" || field === "isTrending" || field === "isNew") {
    await prisma.series.update({
      where: { id },
      data: { [field]: !series[field] },
    });
  }
  revalidatePath("/admin/shows");
  revalidatePath("/");
  revalidatePath("/shows");
  revalidatePath("/genres");
}

export async function saveGenre(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("请填写分类名称");
  const slug = slugify(String(formData.get("slug") || name));
  const data = {
    name,
    slug,
    blurb: String(formData.get("blurb") || "").trim(),
    hook: String(formData.get("hook") || "").trim(),
    offer: String(formData.get("offer") || "").trim(),
    proof: String(formData.get("proof") || "").trim(),
    sortOrder: Number(formData.get("sortOrder") || 0),
    isEnabled: formData.get("isEnabled") === "on",
  };
  if (id) await prisma.genre.update({ where: { id }, data });
  else await prisma.genre.create({ data });
  revalidatePath("/admin/categories");
  revalidatePath("/genres");
  revalidatePath("/");
  revalidatePath("/go");
  revalidatePath("/sitemap.xml");
}

export async function deleteGenre(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  await prisma.genre.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/genres");
  revalidatePath("/");
}

export async function moveGenre(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const dir = String(formData.get("dir") || "up") === "down" ? 1 : -1;
  const rows = await prisma.genre.findMany({ orderBy: { sortOrder: "asc" } });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  await prisma.$transaction([
    prisma.genre.update({ where: { id: rows[i].id }, data: { sortOrder: rows[j].sortOrder } }),
    prisma.genre.update({ where: { id: rows[j].id }, data: { sortOrder: rows[i].sortOrder } }),
  ]);
  revalidatePath("/admin/categories");
  revalidatePath("/genres");
  revalidatePath("/");
}

export async function saveSlide(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const seriesId = String(formData.get("seriesId") || "").trim() || null;
  let imageUrl = String(formData.get("imageUrl") || "").trim();
  let title = String(formData.get("title") || "").trim();
  let subtitle = String(formData.get("subtitle") || "").trim();
  let href = String(formData.get("href") || "").trim();
  if (seriesId && (!imageUrl || !title || !href)) {
    const show = await prisma.series.findUnique({ where: { id: seriesId } });
    if (show) {
      if (!imageUrl) imageUrl = show.backdropUrl || show.coverUrl;
      if (!title) title = show.title;
      if (!subtitle) subtitle = show.hook;
      if (!href) href = `/watch/${show.slug}/1`;
    }
  }
  if (!title) throw new Error("请填写轮播标题");
  if (!imageUrl) throw new Error("请上传或选择一张轮播图");
  const startsRaw = String(formData.get("startsAt") || "").trim();
  const endsRaw = String(formData.get("endsAt") || "").trim();
  const data = {
    title,
    subtitle,
    ctaLabel: String(formData.get("ctaLabel") || "Play Episode 1 free").trim() || "Watch now",
    href: href || "/pricing",
    imageUrl,
    seriesId,
    sortOrder: Number(formData.get("sortOrder") || 0),
    isEnabled: formData.get("isEnabled") === "on",
    startsAt: startsRaw ? parseShanghaiInput(startsRaw) : null,
    endsAt: endsRaw ? parseShanghaiInput(endsRaw) : null,
  };
  if (id) await prisma.heroSlide.update({ where: { id }, data });
  else await prisma.heroSlide.create({ data });
  revalidatePath("/admin/home");
  revalidatePath("/");
}

export async function deleteSlide(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  await prisma.heroSlide.delete({ where: { id } });
  revalidatePath("/admin/home");
  revalidatePath("/");
}

export async function moveSlide(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const dir = String(formData.get("dir") || "up") === "down" ? 1 : -1;
  const rows = await prisma.heroSlide.findMany({ orderBy: { sortOrder: "asc" } });
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  await prisma.$transaction([
    prisma.heroSlide.update({ where: { id: rows[i].id }, data: { sortOrder: rows[j].sortOrder } }),
    prisma.heroSlide.update({ where: { id: rows[j].id }, data: { sortOrder: rows[i].sortOrder } }),
  ]);
  revalidatePath("/admin/home");
  revalidatePath("/");
}

export async function toggleSlide(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const row = await prisma.heroSlide.findUnique({ where: { id } });
  if (!row) return;
  await prisma.heroSlide.update({ where: { id }, data: { isEnabled: !row.isEnabled } });
  revalidatePath("/admin/home");
  revalidatePath("/");
}

export async function toggleReviewHidden(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const row = await prisma.review.findUnique({ where: { id } });
  if (!row) return;
  await prisma.review.update({ where: { id }, data: { isHidden: !row.isHidden } });
  revalidatePath("/admin/reviews");
  revalidatePath("/shows");
}

export async function adjustCoins(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const delta = Number(formData.get("delta") || 0);
  if (!id || !Number.isFinite(delta) || delta === 0) return;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === "admin") return;
  await prisma.user.update({
    where: { id },
    data: { coins: Math.max(0, user.coins + Math.trunc(delta)) },
  });
  const actor=await requireAdmin();
  if(actor) await prisma.adminAudit.create({data:{actorId:actor.id,userId:id,action:"user_update",detail:"账号状态或金币更新"}});
  revalidatePath("/admin/users");
}

export async function grantVip(formData: FormData) { const { manageMember } = await import("./members/actions"); formData.set("action", "grant"); await manageMember(formData); }
export async function cancelVip(formData: FormData) { const { manageMember } = await import("./members/actions"); formData.set("action", "revoke"); await manageMember(formData); }

export async function testAndSaveR2(formData: FormData) {
  await guard();
  const { testR2Connection, r2EndpointFor } = await import("@/lib/storage");
  const currentId = String(formData.get("id") || "");
  const existing = currentId ? await prisma.storageEndpoint.findUnique({ where: { id: currentId } }) : null;
  const accessKey = String(formData.get("accessKey") || "").trim() || existing?.accessKey || "";
  const secretKey = String(formData.get("secretKey") || "").trim() || existing?.secretKey || "";
  const accountId = String(formData.get("accountId") || existing?.accountId || "").trim();
  const bucket = String(formData.get("bucket") || existing?.bucket || "").trim();
  const publicBaseUrl = String(formData.get("publicBaseUrl") || existing?.publicBaseUrl || "").trim();
  const endpoint = r2EndpointFor(accountId, String(formData.get("endpoint") || existing?.endpoint || ""));
  const result = await testR2Connection({
    accountId,
    endpoint,
    region: String(formData.get("region") || existing?.region || "auto"),
    accessKey,
    secretKey,
    bucket,
    publicBaseUrl,
  });
  const label = String(formData.get("label") || existing?.label || "正式 R2 桶").trim() || "正式 R2 桶";
  const shared = {
    label,
    provider: "r2",
    accountId,
    bucket,
    endpoint,
    region: String(formData.get("region") || "auto") || "auto",
    publicBaseUrl,
    weight: Number(formData.get("weight") || existing?.weight || 1) || 1,
    sortOrder: Number(formData.get("sortOrder") || existing?.sortOrder || 0),
    isEnabled: true,
    lastError: result.ok ? "" : result.message.slice(0, 500),
    lastOkAt: result.ok ? new Date() : existing?.lastOkAt || null,
  };
  const data = {
    ...shared,
    ...(String(formData.get("accessKey") || "").trim() ? { accessKey } : existing ? {} : { accessKey }),
    ...(String(formData.get("secretKey") || "").trim() ? { secretKey } : existing ? {} : { secretKey }),
  };
  let id = currentId;
  if (existing) await prisma.storageEndpoint.update({ where: { id: existing.id }, data });
  else {
    const created = await prisma.storageEndpoint.create({
      data: { ...shared, accessKey, secretKey },
    });
    id = created.id;
  }
  // Official bucket records may be saved for reference, but they must not become the site upload channel.
  if (formData.get("activate") === "on") {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: { storageMode: "r2studio" },
      create: { id: "default", storageMode: "r2studio" },
    });
  }
  revalidatePath("/admin/storage");
  redirect(`/admin/storage?ok=${result.ok ? "1" : "0"}&msg=${encodeURIComponent(result.message)}&id=${id}`);
}

export async function activateLocalStorage() {
  await guard();
  // Local disk is no longer an upload destination. Keep the default R2 Studio mode.
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: { storageMode: "r2studio" },
    create: { id: "default", storageMode: "r2studio" },
  });
  revalidatePath("/admin/storage");
}
