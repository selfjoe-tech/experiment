export default function ExploreNicheTagPage() {
  const params = useParams<{ tab: string; tag: string }>();
  const tagSlug = params?.tag || "";
  return (
    <>
      

      <div className="relative min-h-screen bg-black text-white overflow-hidden">
        <TagVideoFeed tagSlug={tagSlug} onScrollDirectionChange={onScrollDirectionChange} />
      </div>
    </>
  );
}
