import { Dashboard } from "@/components/Dashboard";
import { Page } from "@/components/ui";
import { getAllLessonMeta, getAllProjectMeta, getNav } from "@/lib/content";

export default function Home() {
  return (
    <Page>
      <Dashboard nav={getNav()} projects={getAllProjectMeta()} quizLessons={getAllLessonMeta().filter((l) => l.quiz.length).length} />
    </Page>
  );
}
