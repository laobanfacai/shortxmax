import { SeriesForm } from "@/components/admin/SeriesForm";
import { getAllGenres } from "@/lib/genres";

export default async function NewShowPage() {
  const genres = await getAllGenres();
  return (
    <div>
      <h1 className="admin-title">新建剧集</h1>
      <p className="admin-hint">填写英文前台展示信息。勾选推荐/热门/新片会立刻出现在首页对应栏。</p>
      <div className="mt-6">
        <SeriesForm genres={genres} />
      </div>
    </div>
  );
}
