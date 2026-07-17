#!/usr/bin/env python3
"""DOGAGAの小容量テスト素材を標準ライブラリだけで生成・検証する。"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import tempfile
import wave
import zlib
from io import BytesIO
from pathlib import Path
from typing import Callable


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPOSITORY_ROOT / "test" / "fixtures" / "manifest.json"
GENERATOR_ID = "dogaga-builtin-fixtures-v2"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

PREPARATION_STATUSES = {"planned", "generated", "verified", "rejected"}
RIGHTS_REVIEW_STATUSES = {"pending", "reviewed", "rejected"}
PERMISSION_STATUSES = {"allowed", "prohibited", "pending"}
STORAGE_CLASSES = {"generated", "local-only", "private-local-only", "restricted-external"}
PRIVACY_STATUSES = {"none", "consent-recorded", "authorized", "removed", "unknown"}
MEASUREMENT_STATUSES = {"not-run", "completed", "blocked"}
MEASUREMENT_OUTCOMES = {"pass", "fail", "not-run", "inconclusive", "not-applicable"}


def _wav_bytes(
    *,
    channels: int,
    sample_rate: int,
    sample_count: int,
    sample: Callable[[int, int], int],
) -> bytes:
    buffer = BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        frames = bytearray()
        for sample_index in range(sample_count):
            for channel in range(channels):
                frames.extend(struct.pack("<h", sample(sample_index, channel)))
        output.writeframes(frames)
    return buffer.getvalue()


def _silence_wav() -> bytes:
    return _wav_bytes(
        channels=1,
        sample_rate=48_000,
        sample_count=48_000,
        sample=lambda _sample_index, _channel: 0,
    )


def _sync_pulses_wav() -> bytes:
    sample_rate = 48_000
    pulse_starts = (sample_rate // 2, sample_rate * 3 // 2, sample_rate * 5 // 2)
    pulse_length = sample_rate // 50

    def sample(sample_index: int, channel: int) -> int:
        for pulse_start in pulse_starts:
            offset = sample_index - pulse_start
            if 0 <= offset < pulse_length:
                sign = 1 if ((offset * 1_000) // sample_rate) % 2 == 0 else -1
                amplitude = 12_000 if channel == 0 else 8_000
                return amplitude * sign
        return 0

    return _wav_bytes(
        channels=2,
        sample_rate=sample_rate,
        sample_count=sample_rate * 3,
        sample=sample,
    )


def _continuous_tone_wav() -> bytes:
    sample_rate = 48_000

    def sample(sample_index: int, channel: int) -> int:
        frequency = 440 if channel == 0 else 880
        sign = 1 if ((sample_index * frequency * 2) // sample_rate) % 2 == 0 else -1
        return 8_000 * sign

    return _wav_bytes(
        channels=2,
        sample_rate=sample_rate,
        sample_count=sample_rate * 3,
        sample=sample,
    )


def _png_chunk(chunk_type: bytes, payload: bytes) -> bytes:
    checksum = zlib.crc32(chunk_type)
    checksum = zlib.crc32(payload, checksum) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + chunk_type + payload + struct.pack(">I", checksum)


def _stored_zlib_stream(payload: bytes) -> bytes:
    """圧縮実装の差を避け、固定の無圧縮DEFLATEストリームを作る。"""

    stream = bytearray(b"\x78\x01")
    offset = 0
    while offset < len(payload):
        block = payload[offset : offset + 65_535]
        offset += len(block)
        is_final = 1 if offset == len(payload) else 0
        stream.append(is_final)
        stream.extend(struct.pack("<H", len(block)))
        stream.extend(struct.pack("<H", 0xFFFF ^ len(block)))
        stream.extend(block)
    stream.extend(struct.pack(">I", zlib.adler32(payload) & 0xFFFFFFFF))
    return bytes(stream)


def _png_bytes(width: int, height: int, pixel: Callable[[int, int], tuple[int, int, int]]) -> bytes:
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0)
        for x in range(width):
            scanlines.extend(pixel(x, y))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"".join(
        (
            PNG_SIGNATURE,
            _png_chunk(b"IHDR", header),
            _png_chunk(b"IDAT", _stored_zlib_stream(bytes(scanlines))),
            _png_chunk(b"IEND", b""),
        )
    )


def _png_rgba_bytes(
    width: int,
    height: int,
    pixel: Callable[[int, int], tuple[int, int, int, int]],
) -> bytes:
    scanlines = bytearray()
    for y in range(height):
        scanlines.append(0)
        for x in range(width):
            scanlines.extend(pixel(x, y))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"".join(
        (
            PNG_SIGNATURE,
            _png_chunk(b"IHDR", header),
            _png_chunk(b"IDAT", _stored_zlib_stream(bytes(scanlines))),
            _png_chunk(b"IEND", b""),
        )
    )


def _color_bars_png() -> bytes:
    colors = (
        (255, 255, 255),
        (255, 255, 0),
        (0, 255, 255),
        (0, 255, 0),
        (255, 0, 255),
        (255, 0, 0),
        (0, 0, 255),
        (0, 0, 0),
    )

    def pixel(x: int, y: int) -> tuple[int, int, int]:
        color = colors[min((x * len(colors)) // 320, len(colors) - 1)]
        if y >= 160:
            gray = (x * 255) // 319
            return gray, gray, gray
        return color

    return _png_bytes(320, 180, pixel)


def _seek_grid_png() -> bytes:
    def pixel(x: int, y: int) -> tuple[int, int, int]:
        if x in (0, 80, 160, 240, 319) or y in (0, 45, 90, 135, 179):
            return 255, 255, 255
        if abs(x - (y * 319 // 179)) <= 2:
            return 255, 64, 64
        if (x - 240) ** 2 + (y - 45) ** 2 <= 18**2:
            return 64, 192, 255
        return (24, 28, 36) if ((x // 20) + (y // 20)) % 2 == 0 else (40, 46, 58)

    return _png_bytes(320, 180, pixel)


def _alpha_gradient_png() -> bytes:
    def pixel(x: int, y: int) -> tuple[int, int, int, int]:
        alpha = (x * 255) // 319
        checker = 40 if ((x // 20) + (y // 20)) % 2 == 0 else 0
        return 64 + checker, 128 + checker, 215, alpha

    return _png_rgba_bytes(320, 180, pixel)


GENERATORS: dict[str, Callable[[], bytes]] = {
    "audio-silence-1s-mono-48000.wav": _silence_wav,
    "audio-sync-pulses-3s-stereo-48000.wav": _sync_pulses_wav,
    "audio-tone-3s-stereo-48000.wav": _continuous_tone_wav,
    "image-color-bars-320x180.png": _color_bars_png,
    "image-seek-grid-320x180.png": _seek_grid_png,
    "image-alpha-gradient-320x180.png": _alpha_gradient_png,
}


def _require_fields(value: dict, fields: tuple[str, ...], context: str) -> None:
    missing = [field for field in fields if field not in value]
    if missing:
        raise ValueError(f"{context}に必須項目がありません: {missing}")


def _require_non_empty_string(value: object, context: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context}は空でない文字列でなければなりません")


def _validate_rights(rights: object, context: str) -> None:
    if not isinstance(rights, dict):
        raise ValueError(f"{context}.rightsはobjectでなければなりません")
    _require_fields(
        rights,
        (
            "origin",
            "thirdPartyContent",
            "rightsHolder",
            "license",
            "reviewStatus",
            "permissions",
            "basis",
        ),
        f"{context}.rights",
    )
    _require_non_empty_string(rights["origin"], f"{context}.rights.origin")
    if not isinstance(rights["thirdPartyContent"], bool):
        raise ValueError(f"{context}.rights.thirdPartyContentはbooleanでなければなりません")
    _require_non_empty_string(rights["rightsHolder"], f"{context}.rights.rightsHolder")
    _require_non_empty_string(rights["basis"], f"{context}.rights.basis")

    license_record = rights["license"]
    if not isinstance(license_record, dict):
        raise ValueError(f"{context}.rights.licenseはobjectでなければなりません")
    _require_fields(license_record, ("status", "identifier"), f"{context}.rights.license")
    if license_record["status"] not in {"not-selected", "selected"}:
        raise ValueError(f"{context}.rights.license.statusが未定義です")
    identifier = license_record["identifier"]
    if license_record["status"] == "selected":
        _require_non_empty_string(identifier, f"{context}.rights.license.identifier")
    elif identifier is not None:
        raise ValueError(f"{context}.rights.license.identifierは未選択時にnullでなければなりません")

    review_status = rights["reviewStatus"]
    if review_status not in RIGHTS_REVIEW_STATUSES:
        raise ValueError(f"{context}.rights.reviewStatusが未定義です")
    if review_status == "reviewed":
        _require_fields(rights, ("reviewedBy", "reviewedAt"), f"{context}.rights")
        _require_non_empty_string(rights["reviewedBy"], f"{context}.rights.reviewedBy")
        _require_non_empty_string(rights["reviewedAt"], f"{context}.rights.reviewedAt")

    permissions = rights["permissions"]
    if not isinstance(permissions, dict):
        raise ValueError(f"{context}.rights.permissionsはobjectでなければなりません")
    permission_names = (
        "localDevelopment",
        "ciArtifactTransfer",
        "collaboratorTransfer",
        "publicRedistribution",
    )
    _require_fields(permissions, permission_names, f"{context}.rights.permissions")
    invalid_permissions = [
        f"{name}={permissions[name]!r}"
        for name in permission_names
        if not isinstance(permissions[name], str) or permissions[name] not in PERMISSION_STATUSES
    ]
    if invalid_permissions:
        raise ValueError(f"{context}.rights.permissionsに未定義の値があります: {invalid_permissions}")


def _validate_measurements(measurements: object, context: str) -> None:
    if not isinstance(measurements, list):
        raise ValueError(f"{context}.measurementsはarrayでなければなりません")
    for index, measurement in enumerate(measurements):
        measurement_context = f"{context}.measurements[{index}]"
        if not isinstance(measurement, dict):
            raise ValueError(f"{measurement_context}はobjectでなければなりません")
        _require_fields(
            measurement,
            ("environment", "status", "results"),
            measurement_context,
        )
        environment = measurement["environment"]
        if not isinstance(environment, dict):
            raise ValueError(f"{measurement_context}.environmentはobjectでなければなりません")
        environment_fields = ("os", "osVersion", "browser", "browserVersion")
        _require_fields(environment, environment_fields, f"{measurement_context}.environment")
        for field in environment_fields:
            _require_non_empty_string(
                environment[field],
                f"{measurement_context}.environment.{field}",
            )

        status = measurement["status"]
        if status not in MEASUREMENT_STATUSES:
            raise ValueError(f"{measurement_context}.statusが未定義です")
        results = measurement["results"]
        if not isinstance(results, dict):
            raise ValueError(f"{measurement_context}.resultsはobjectでなければなりません")
        invalid_outcomes = [
            f"{operation}={outcome!r}"
            for operation, outcome in results.items()
            if not isinstance(outcome, str) or outcome not in MEASUREMENT_OUTCOMES
        ]
        if invalid_outcomes:
            raise ValueError(f"{measurement_context}.resultsに未定義の結果があります: {invalid_outcomes}")
        if status == "completed":
            _require_fields(
                measurement,
                ("fixtureSha256", "measuredAt", "measuredBy", "evidence"),
                measurement_context,
            )
            fixture_hash = measurement["fixtureSha256"]
            if (
                not isinstance(fixture_hash, str)
                or len(fixture_hash) != 64
                or any(character not in "0123456789abcdef" for character in fixture_hash)
            ):
                raise ValueError(f"{measurement_context}.fixtureSha256が不正です")
            for field in ("measuredAt", "measuredBy", "evidence"):
                _require_non_empty_string(measurement[field], f"{measurement_context}.{field}")
            if not results:
                raise ValueError(f"{measurement_context}.resultsは実測完了時に空にできません")


def _validate_fixture(fixture: object, index: int) -> None:
    context = f"fixtures[{index}]"
    if not isinstance(fixture, dict):
        raise ValueError(f"{context}はobjectでなければなりません")
    _require_fields(
        fixture,
        (
            "id",
            "fileName",
            "preparationStatus",
            "mediaType",
            "purpose",
            "properties",
            "rights",
            "privacy",
            "storage",
            "measurements",
        ),
        context,
    )
    _require_non_empty_string(fixture["id"], f"{context}.id")
    if fixture["fileName"] is not None:
        _require_non_empty_string(fixture["fileName"], f"{context}.fileName")
    if fixture["preparationStatus"] not in PREPARATION_STATUSES:
        raise ValueError(f"{context}.preparationStatusが未定義です")
    _require_non_empty_string(fixture["mediaType"], f"{context}.mediaType")
    if (
        not isinstance(fixture["purpose"], list)
        or not fixture["purpose"]
        or any(not isinstance(value, str) or not value.strip() for value in fixture["purpose"])
    ):
        raise ValueError(f"{context}.purposeは空でない文字列のarrayでなければなりません")
    if not isinstance(fixture["properties"], dict) or not fixture["properties"]:
        raise ValueError(f"{context}.propertiesは空でないobjectでなければなりません")

    _validate_rights(fixture["rights"], context)

    privacy = fixture["privacy"]
    if not isinstance(privacy, dict):
        raise ValueError(f"{context}.privacyはobjectでなければなりません")
    privacy_fields = ("people", "voices", "logos", "location", "metadata")
    _require_fields(privacy, privacy_fields, f"{context}.privacy")
    invalid_privacy = [
        f"{field}={privacy[field]!r}"
        for field in privacy_fields
        if not isinstance(privacy[field], str) or privacy[field] not in PRIVACY_STATUSES
    ]
    if invalid_privacy:
        raise ValueError(f"{context}.privacyに未定義の値があります: {invalid_privacy}")

    storage = fixture["storage"]
    if not isinstance(storage, dict):
        raise ValueError(f"{context}.storageはobjectでなければなりません")
    _require_fields(storage, ("class", "locationId"), f"{context}.storage")
    if storage["class"] not in STORAGE_CLASSES:
        raise ValueError(f"{context}.storage.classが未定義です")
    if storage["locationId"] is not None:
        _require_non_empty_string(storage["locationId"], f"{context}.storage.locationId")

    _validate_measurements(fixture["measurements"], context)

    if fixture["preparationStatus"] in {"generated", "verified"}:
        _require_fields(fixture, ("generation",), context)
        if fixture["fileName"] is None:
            raise ValueError(f"{context}.fileNameは生成済み状態でnullにできません")
        if not isinstance(fixture["generation"], dict):
            raise ValueError(f"{context}.generationはobjectでなければなりません")
        _require_fields(fixture["generation"], ("tool", "networkAccess"), f"{context}.generation")
        _require_non_empty_string(fixture["generation"]["tool"], f"{context}.generation.tool")
        if not isinstance(fixture["generation"]["networkAccess"], bool):
            raise ValueError(f"{context}.generation.networkAccessはbooleanでなければなりません")

    if fixture["preparationStatus"] == "verified":
        _require_fields(fixture, ("expected",), context)
        if not isinstance(fixture["expected"], dict):
            raise ValueError(f"{context}.expectedはobjectでなければなりません")
        _require_fields(fixture["expected"], ("bytes", "sha256"), f"{context}.expected")
        if not isinstance(fixture["expected"]["bytes"], int) or fixture["expected"]["bytes"] <= 0:
            raise ValueError(f"{context}.expected.bytesは正の整数でなければなりません")
        expected_hash = fixture["expected"]["sha256"]
        if (
            not isinstance(expected_hash, str)
            or len(expected_hash) != 64
            or any(character not in "0123456789abcdef" for character in expected_hash)
        ):
            raise ValueError(f"{context}.expected.sha256が不正です")


def _load_manifest(path: Path) -> dict:
    with path.open(encoding="utf-8") as manifest_file:
        manifest = json.load(manifest_file)
    if not isinstance(manifest, dict):
        raise ValueError("manifestのルートはobjectでなければなりません")
    _require_fields(manifest, ("schemaVersion", "updatedAt", "generatorVersion", "fixtures"), "manifest")
    if manifest.get("schemaVersion") != 2:
        raise ValueError("未対応のmanifest schemaVersionです")
    if manifest.get("generatorVersion") != GENERATOR_ID:
        raise ValueError("manifestのgeneratorVersionが生成器と一致しません")
    _require_non_empty_string(manifest["updatedAt"], "manifest.updatedAt")
    if not isinstance(manifest["fixtures"], list) or not manifest["fixtures"]:
        raise ValueError("manifest.fixturesは空でないarrayでなければなりません")
    for index, fixture in enumerate(manifest["fixtures"]):
        _validate_fixture(fixture, index)
    fixture_ids = [fixture["id"] for fixture in manifest["fixtures"]]
    if len(fixture_ids) != len(set(fixture_ids)):
        raise ValueError("manifestに重複したfixture IDがあります")
    return manifest


def _generated_entries(manifest: dict) -> list[dict]:
    entries = [
        fixture
        for fixture in manifest["fixtures"]
        if fixture.get("generation", {}).get("tool") == GENERATOR_ID
    ]
    declared_files = {entry["fileName"] for entry in entries}
    if declared_files != set(GENERATORS):
        raise ValueError("manifestと生成器のファイル一覧が一致しません")
    return entries


def _inspect_png(content: bytes) -> list[str]:
    if not content.startswith(PNG_SIGNATURE):
        raise ValueError("PNGシグネチャがありません")
    chunk_types: list[str] = []
    offset = len(PNG_SIGNATURE)
    while offset < len(content):
        length = struct.unpack(">I", content[offset : offset + 4])[0]
        chunk_type = content[offset + 4 : offset + 8]
        payload = content[offset + 8 : offset + 8 + length]
        expected_crc = struct.unpack(">I", content[offset + 8 + length : offset + 12 + length])[0]
        actual_crc = zlib.crc32(payload, zlib.crc32(chunk_type)) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise ValueError("PNGチャンクのCRCが一致しません")
        chunk_types.append(chunk_type.decode("ascii"))
        offset += 12 + length
    if offset != len(content):
        raise ValueError("PNGチャンク境界が不正です")
    return chunk_types


def _inspect_wav(content: bytes) -> list[str]:
    if content[:4] != b"RIFF" or content[8:12] != b"WAVE":
        raise ValueError("RIFF/WAVEヘッダーがありません")
    chunk_types: list[str] = []
    offset = 12
    while offset < len(content):
        chunk_type = content[offset : offset + 4]
        length = struct.unpack("<I", content[offset + 4 : offset + 8])[0]
        chunk_types.append(chunk_type.decode("ascii"))
        offset += 8 + length + (length % 2)
    if offset != len(content):
        raise ValueError("WAVチャンク境界が不正です")
    return chunk_types


def _report(entry: dict, content: bytes) -> dict:
    if entry["mediaType"] == "image/png":
        chunks = _inspect_png(content)
        if chunks != ["IHDR", "IDAT", "IEND"]:
            raise ValueError(f"許可していないPNGチャンクがあります: {chunks}")
    elif entry["mediaType"] == "audio/wav":
        chunks = _inspect_wav(content)
        if chunks != ["fmt ", "data"]:
            raise ValueError(f"許可していないWAVチャンクがあります: {chunks}")
    else:
        raise ValueError(f"検証対象外のmediaTypeです: {entry['mediaType']}")
    return {
        "fileName": entry["fileName"],
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "chunks": chunks,
    }


def _build_reports(manifest: dict) -> tuple[list[dict], dict[str, bytes]]:
    contents: dict[str, bytes] = {}
    reports: list[dict] = []
    for entry in _generated_entries(manifest):
        content = GENERATORS[entry["fileName"]]()
        contents[entry["fileName"]] = content
        reports.append(_report(entry, content))
    return reports, contents


def _verify_expected(manifest: dict, reports: list[dict]) -> None:
    report_by_file = {report["fileName"]: report for report in reports}
    for entry in _generated_entries(manifest):
        report = report_by_file[entry["fileName"]]
        if report["bytes"] != entry["expected"]["bytes"]:
            raise ValueError(f"{entry['fileName']} のbytesがmanifestと一致しません")
        if report["sha256"] != entry["expected"]["sha256"]:
            raise ValueError(f"{entry['fileName']} のSHA-256がmanifestと一致しません")


def _write_without_overwrite(output_dir: Path, contents: dict[str, bytes]) -> None:
    if output_dir.is_symlink():
        raise FileExistsError(f"シンボリックリンクを出力先にできません: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    for file_name, content in contents.items():
        destination = output_dir / file_name
        if destination.is_symlink():
            raise FileExistsError(f"シンボリックリンクへは書き込みません: {destination}")
        if destination.exists():
            if destination.read_bytes() == content:
                print(f"変更なし: {destination}")
                continue
            raise FileExistsError(f"既存ファイルを上書きしません: {destination}")
        with destination.open("xb") as output_file:
            output_file.write(content)
        print(f"生成: {destination}")


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument(
        "--check",
        action="store_true",
        help="一時生成してハッシュとメタデータを検証する",
    )
    action.add_argument("--report", action="store_true", help="現在の生成結果をJSONで表示する")
    action.add_argument("--output-dir", type=Path, help="検証済みfixtureを指定ディレクトリへ生成する")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    manifest = _load_manifest(args.manifest)
    reports, contents = _build_reports(manifest)
    if args.report:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
        return 0

    _verify_expected(manifest, reports)
    if args.check:
        second_reports, second_contents = _build_reports(manifest)
        if reports != second_reports or contents != second_contents:
            raise ValueError("同一プロセス内の再生成結果が一致しません")
        with tempfile.TemporaryDirectory(prefix="dogaga-fixtures-") as temporary_dir:
            _write_without_overwrite(Path(temporary_dir), second_contents)
            disk_reports = [
                _report(entry, (Path(temporary_dir) / entry["fileName"]).read_bytes())
                for entry in _generated_entries(manifest)
            ]
            if reports != disk_reports:
                raise ValueError("生成直後のfixtureが生成結果と一致しません")
        print(f"検証完了: {len(reports)}件（決定性、SHA-256、許可チャンク）")
        return 0

    _write_without_overwrite(args.output_dir, contents)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
