"""Prepare a multi-store catalog candidate; never publish automatically.

Usage: python scripts/kendince/refresh-all.py [--output-dir kendince-audit]
The candidate and evidence report are reviewable. --write is an explicit local
acceptance step and does not commit, push or deploy anything.
"""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=pathlib.Path, default=ROOT / 'kendince-audit')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    # Keep each source's own stock/price provenance and failures in its feed.
    subprocess.run([sys.executable, str(ROOT / 'scripts/kendince/refresh.py'),
                    '--output-dir', str(out / 'lcw')], check=True, cwd=ROOT,
                   stdout=(out / 'lcw-refresh.log').open('w'), stderr=subprocess.STDOUT)
    feeds = []
    for suffix in ('a', 'b', 'c'):
        feed = out / f'retailers-{suffix}.json'
        subprocess.run([sys.executable, str(ROOT / f'scripts/kendince/retailers-{suffix}.py'),
                        '--output', str(feed)], check=True, cwd=ROOT,
                       stdout=(out / f'retailers-{suffix}.log').open('w'), stderr=subprocess.STDOUT)
        feeds.append(str(feed))
    command = [sys.executable, str(ROOT / 'scripts/kendince/merge-catalog.py'),
               '--base', str(out / 'lcw/catalog.json'), '--output', str(out / 'catalog.json'), *feeds]
    if args.write:
        command.append('--write')
    subprocess.run(command, check=True, cwd=ROOT)
    print('Review candidate:', out / 'catalog.json')
    print('Review evidence:', out / 'expanded-report.json')


if __name__ == '__main__':
    main()
