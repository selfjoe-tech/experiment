// app/watch/[id]/head.tsx
export default function Head({ params }: { params: { id: string } }) {
  const site =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://upskirtcandy.com").replace(/\/$/, "");

  const canonical = `${site}/watch/${encodeURIComponent(params.id)}`;
  const oembedHref = `${site}/oembed?format=json&url=${encodeURIComponent(canonical)}`;

  return (
    <>
      <link rel="alternate" type="application/json+oembed" href={oembedHref} />
    </>
  );
}
