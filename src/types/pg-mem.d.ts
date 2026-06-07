declare module "pg-mem" {
  export function newDb(): {
    adapters: {
      createPg(): {
        Pool: unknown;
      };
    };
  };
}
