import assert from "node:assert/strict";
import { formatPublicListing } from "../lib/publicListingFormatter.ts";

const cases = [
  {
    name: "A",
    title: "MB 288 đường 3/2 P.12 Q.10",
    description: "7.1x18 LDR 120tr hh5n1T 0983279878",
    expected: ["Mặt Bằng đường 3/2, Phường 12, Quận 10", "7.1x18", "LDR", "120tr"],
  },
  {
    name: "B",
    title: "MB 262-264 Tên Lửa, P.An Lạc, Q.Bình Tân",
    description: "8x22 trệt lửng 2P 2wc LDC\n55tr hh20tr 0764737907",
    expected: ["Mặt Bằng Tên Lửa, Phường An Lạc, Quận Bình Tân", "8x22", "trệt lửng 2P 2wc LDC", "55tr"],
  },
  {
    name: "C",
    title: "156 Trần Kế Xương P.7 Q.Phú Nhuận",
    description: "5x12 trệt lầu suốt 2wc\n17tr hh1/2 0797156570",
    expected: ["Mặt Tiền Trần Kế Xương, Phường 7, Quận Phú Nhuận", "5x12", "trệt lầu suốt 2wc", "17tr"],
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
    expected: ["Hẻm Xe Hơi Cách Mạng Tháng 8, Phường 15, Quận 10", "3.5x14", "trệt lầu 2pn 1wc", "12tr"],
  },
  {
    name: "F",
    title: "106/58 Cống Lở P.15 Q.Tân Bình",
    description: "hxt 4x15 trệt lửng 2 lầu 4pn 3wc\n18tr hh báo sau 0934460959",
    expected: ["Hẻm Xe Tải Cống Lở, Phường 15, Quận Tân Bình", "4x15", "trệt lửng 2 lầu 4pn 3wc", "18tr"],
  },
];

const addressCases = [
  {
    name: "public-MT-lot",
    title: "MT Lô K CC Phan Xích Long P.2 Q.Phú Nhuận",
    expected: "Mặt Tiền Phan Xích Long, Phường 2, Quận Phú Nhuận",
  },
  {
    name: "public-MB",
    title: "MB 262-264 Tên Lửa, P.An Lạc, Q.Bình Tân",
    expected: "Mặt Bằng Tên Lửa, Phường An Lạc, Quận Bình Tân",
  },
  {
    name: "public-HXH",
    title: "601/22 Cách Mạng Tháng 8, P.15, Q.10",
    description: "hxh",
    expected: "Hẻm Xe Hơi Cách Mạng Tháng 8, Phường 15, Quận 10",
  },
  {
    name: "public-HXT",
    title: "106/58 Cống Lở P.15 Q.Tân Bình",
    description: "hxt",
    expected: "Hẻm Xe Tải Cống Lở, Phường 15, Quận Tân Bình",
  },
  {
    name: "public-alley",
    title: "55/31/2 Thành Mỹ P.8 Q.Tân Bình",
    expected: "Hẻm Thành Mỹ, Phường 8, Quận Tân Bình",
  },
  {
    name: "public-frontage",
    title: "615A Đường 3/2, P.8, Q.10",
    expected: "Mặt Tiền Đường 3/2, Phường 8, Quận 10",
  },
  {
    name: "public-leading-alley",
    title: "Hẻm /200 Đặng Thùy Trâm Q.Bình Thạnh",
    expected: "Hẻm Đặng Thùy Trâm, Quận Bình Thạnh",
  },
  {
    name: "public-duplicate-prefixes",
    title: "Mặt Bằng MB 262-264 Tên Lửa P.An Lạc Q.Bình Tân",
    expected: "Mặt Bằng Tên Lửa, Phường An Lạc, Quận Bình Tân",
  },
  {
    name: "public-duplicate-alley",
    title: "Hẻm Hẻm 55/31/2 Thành Mỹ P.8 Q.Tân Bình",
    expected: "Hẻm Thành Mỹ, Phường 8, Quận Tân Bình",
  },
  {
    name: "public-two-frontages-no-duplicate",
    title: "Hai Mặt Tiền Hẻm 2MT 615A Đường 3/2 P.8 Q.10",
    expected: "Hai Mặt Tiền Đường 3/2, Phường 8, Quận 10",
  },
  {
    name: "public-frontage-no-alley-word",
    title: "Mặt Tiền Hẻm Nguyễn Ngọc Lộc P.14 Q.10",
    expected: "Mặt Tiền Nguyễn Ngọc Lộc, Phường 14, Quận 10",
  },
  {
    name: "public-slash-number-no-duplicate",
    title: "Hẻm Hẻm /200 Đặng Thùy Trâm Q.Bình Thạnh",
    expected: "Hẻm Đặng Thùy Trâm, Quận Bình Thạnh",
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

for (const testCase of addressCases) {
  assert.equal(
    formatPublicListing(testCase).publicTitle,
    testCase.expected,
    `Public address case ${testCase.name}`
  );
}

console.log(
  `Public listing formatter: ${cases.length + addressCases.length}/${cases.length + addressCases.length} cases passed.`
);
