import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EcoTokenModule = buildModule("EcoTokenModule", (m) => {
  const ecoToken = m.contract("EcoToken");
  return { ecoToken };
});

export default EcoTokenModule;