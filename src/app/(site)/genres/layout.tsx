import { GenreSubNav } from "@/components/public/GenreSubNav";
import { getEnabledGenres } from "@/lib/genres";

export default async function GenresLayout({ children }: { children: React.ReactNode }) {
  const genres = await getEnabledGenres();
  return (
    <>
      <GenreSubNav genres={genres} />
      {children}
    </>
  );
}
