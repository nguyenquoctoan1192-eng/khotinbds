import { selectCrosspostGroups } from "../lib/socialPosting";

const groups = [
  {
    id: "1",
    name: "Nhóm đa quận",
    districts: ["Quận 1", "Quận 3"],
    category: "general",
    priority: 1,
  },
  {
    id: "2",
    name: "Nhóm Quận 5",
    districts: ["Quận 5"],
    category: "general",
    priority: 1,
  },
];

console.log(
  selectCrosspostGroups(groups, "Quận 3", ["general"]),
);