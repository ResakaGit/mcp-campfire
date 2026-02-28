import { describe, it, expect } from "vitest";
import { InMemoryCampfireRepository } from "./in-memory-campfire-repository.js";

describe("InMemoryCampfireRepository (capa adaptador persistencia)", () => {
  const repo = new InMemoryCampfireRepository();

  it("getFire devuelve null si la fogata no existe", async () => {
    const fire = await repo.getFire("no-existe");
    expect(fire).toBeNull();
  });

  it("getOrCreateFire crea fogata nueva y devuelve con id y createdAt", async () => {
    const fire = await repo.getOrCreateFire("fire-1");
    expect(fire.id).toBe("fire-1");
    expect(fire.createdAt).toBeDefined();
    expect(typeof fire.createdAt).toBe("string");
  });

  it("getOrCreateFire devuelve la misma fogata si ya existe", async () => {
    const f1 = await repo.getOrCreateFire("fire-same");
    const f2 = await repo.getOrCreateFire("fire-same");
    expect(f1.id).toBe(f2.id);
    expect(f1.createdAt).toBe(f2.createdAt);
  });

  it("postMessage añade mensaje y devuelve con id, fireId, text, createdAt", async () => {
    await repo.getOrCreateFire("fire-msg");
    const msg = await repo.postMessage("fire-msg", {
      text: "primer mensaje",
      author: "agente-1",
    });
    expect(msg.fireId).toBe("fire-msg");
    expect(msg.text).toBe("primer mensaje");
    expect(msg.author).toBe("agente-1");
    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeDefined();
  });

  it("postMessage en fogata inexistente lanza Error con mensaje accionable", async () => {
    await expect(
      repo.postMessage("no-existe", { text: "x" })
    ).rejects.toThrow("Fire with id 'no-existe' does not exist.");
  });

  it("listMessages devuelve [] si la fogata no existe", async () => {
    const list = await repo.listMessages("otra-inexistente");
    expect(list).toEqual([]);
  });

  it("listMessages devuelve mensajes ordenados por createdAt", async () => {
    const fireId = "fire-list";
    await repo.getOrCreateFire(fireId);
    await repo.postMessage(fireId, { text: "primero" });
    await repo.postMessage(fireId, { text: "segundo" });
    const list = await repo.listMessages(fireId);
    expect(list).toHaveLength(2);
    expect(list[0].text).toBe("primero");
    expect(list[1].text).toBe("segundo");
  });

  it("es stateless en la interfaz: cada instancia tiene su store aislado", async () => {
    const repo2 = new InMemoryCampfireRepository();
    await repo2.getOrCreateFire("solo-repo2");
    const fromRepo1 = await repo.getFire("solo-repo2");
    expect(fromRepo1).toBeNull();
  });
});
