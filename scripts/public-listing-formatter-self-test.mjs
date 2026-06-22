import assert from "node:assert/strict";
import { formatPublicListing } from "../lib/publicListingFormatter.ts";

const cases = [
  {
    name: "A",
    title: "MB 288 đường 3/2 P.12 Q.10",
    description: "7.1x18 LDR 120tr hh5n1T 0983279878",
    expected: ["Mặt Bằng đường 3/2 P.12 Q.10", "7.1x18", "LDR", "120tr"],
  },
  {
    name: "B",
    title: "MB 262-264 Tên Lửa, P.An Lạc, Q.Bình Tân",
    description: "8x22 trệt lửng 2P 2wc LDC\n55tr hh20tr 0764737907",
    expected: ["Mặt Bằng Tên Lửa, P.An Lạc, Q.Bình Tân", "8x22", "trệt lửng 2P 2wc LDC", "55tr"],
  },
  {
    name: "C",
    title: "156 Trần Kế Xương P.7 Q.Phú Nhuận",
    description: "5x12 trệt lầu suốt 2wc\n17tr hh1/2 0797156570",
    expected: ["Mặt Tiền Trần Kế Xương P.7 Q.Phú Nhuận", "5x12", "trệt lầu suốt 2wc", "17tr"],
  },
  {
    name: "D",
    title: "Hẻm Xe Hơi 702/1D Sư Vạn Hạnh, Phường 12, Quận 10.",
    description: "DT: 4x14m\nKết cấu: 1Trệt, 2 Lầu, Sân thượng, 5P, 5WC\nGiá: 31tr hhtt\nLH: 090 3710744",
    expected: ["Hẻm Xe Hơi Sư Vạn Hạnh, Phường 12, Quận 10", "4x14m", "1Trệt, 2 Lầu, Sân thượng, 5P, 5WC", "31tr"],
  },
  {
    name: "E",
    title: "601/22 Cách Mạng Tháng 8, P.15, Q.10",
    description: "hxh 3.5x14 trệt lầu 2pn 1wc\n12tr hh1/2 0934343499",
    expected: ["Hẻm Xe Hơi Cách Mạng Tháng 8, P.15, Q.10", "3.5x14", "trệt lầu 2pn 1wc", "12tr"],
  },
  {
    name: "F",
    title: "106/58 Cống Lở P.15 Q.Tân Bình",
    description: "hxt 4x15 trệt lửng 2 lầu 4pn 3wc\n18tr hh báo sau 0934460959",
    expected: ["Hẻm Xe Tải Cống Lở P.15 Q.Tân Bình", "4x15", "trệt lửng 2 lầu 4pn 3wc", "18tr"],
  },
];

for (const testCase of cases) {
  const actual = formatPublicListing(testCase);
  assert.deepEqual(
    [actual.publicTitle, actual.area, actual.structure, actual.price],
    testCase.expected,
    `Public listing case ${testCase.name}`
  );
  assert.equal(actual.contactPhone, "0946497253");
}

console.log(`Public listing formatter: ${cases.length}/${cases.length} cases passed.`);
