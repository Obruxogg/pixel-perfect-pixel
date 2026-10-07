import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getRoomLive } from "@/lib/admin.functions";

export const Route = createFileRoute("/projetar/$id")({
  head: () => ({ meta: [{ title: "Entre na sala — giz." }, { name: "description", content: "Escaneie o QR Code ou digite o código da sala." }, { property: "og:title", content: "Entre na sala — giz." }, { property: "og:description", content: "Escaneie o QR Code ou digite o código da sala." }, { name: "robots", content: "noindex" }] }),
  component: Project,
});

function Project() {
  const { id } = Route.useParams();
  const fn = useServerFn(getRoomLive);
  const { data } = useQuery({ queryKey: ["room", id], queryFn: () => fn({ data: { id } }) });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const code = data?.room.code ?? "";

  return (
    <div className="chalk-texture min-h-screen flex flex-col items-center justify-center text-board-foreground p-8 text-center">
      <p className="text-2xl md:text-4xl uppercase tracking-[0.3em] text-board-muted">Entre na sala</p>
      <p className="font-mono font-extrabold text-accent tracking-[0.15em] text-7xl md:text-[10rem] leading-none my-8">{code || "…"}</p>
      {origin && code && (
        <div className="bg-board-foreground p-5 rounded-2xl">
          <QRCodeSVG value={`${origin}/s/${code}`} size={260} />
        </div>
      )}
      <p className="mt-8 text-xl md:text-2xl max-w-2xl">Escaneie o QR Code ou acesse <b>{origin.replace(/^https?:\/\//, "")}</b> e digite <b className="font-mono text-accent">{code}</b>.</p>
    </div>
  );
}
