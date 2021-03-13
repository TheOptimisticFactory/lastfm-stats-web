import {Component, OnInit} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {filter} from 'rxjs/operators';
import {Month, Streak, StreakStack, StatsBuilderService, TempStats, ScrobbleStreakStack} from '../stats-builder.service';
import {Stats, Top10Item} from '../stats/stats.component';

@Component({
  selector: 'app-lists',
  templateUrl: './lists.component.html',
  styleUrls: ['./lists.component.scss']
})
export class ListsComponent implements OnInit {
  stats = new BehaviorSubject<Stats>(this.emptyStats());

  constructor(private builder: StatsBuilderService) {
  }

  ngOnInit(): void {
    this.builder.tempStats.pipe(filter(s => !!s.last)).subscribe(stats => this.updateStats(stats));
  }

  private updateStats(tempStats: TempStats): void {
    const next = this.emptyStats();
    const endDate = tempStats.last!.date;
    const seen = Object.values(tempStats.seenArtists);
    const streak = this.currentScrobbleStreak(tempStats, endDate);
    next.scrobbleStreak = this.getStreakTop10(streak);
    next.notListenedStreak = this.getStreakTop10(tempStats.notListenedStreak.streaks);
    next.betweenArtists = this.getStreakTop10(tempStats.betweenArtists.streaks, s => `${s.start.artist} (${s.length} days)`);
    next.ongoingBetweenArtists = this.getStreakTop10(
      seen
        .map(a => a.betweenStreak)
        .map(a => ({start: a.start, end: {artist: a.start.artist, track: '?', date: endDate}}))
        .map(a => StreakStack.calcLength(a)),
      s => `${s.start.artist} (${s.length} days)`
    );

    const months = tempStats.monthList;
    const monthsValues = Object.values(months);
    monthsValues.forEach(m => {
      const values = Object.values(m.scrobblesPerArtist);
      const sum = values.reduce((a, b) => a + b, 0);
      m.avg = (sum / values.length) || 0;
    });

    next.newArtistsPerMonth = this.getTop10(months, m => m.newArtists.length, k => months[k], (m, k) => `${m.alias} (${k} artists)`, m => this.including(m));
    next.uniqueArtists = this.getTop10(months, m => Object.keys(m.scrobblesPerArtist).length, k => months[k], (m, k) => `${m.alias} (${k} artists)`, m => this.including(m));

    const arr = Object.values(months)
      .map(m => Object.keys(m.scrobblesPerArtist)
        .filter(k => m.newArtists.map(a => a.artist).indexOf(k) >= 0)
        .map(a => ({artist: a, month: m.alias, amount: m.scrobblesPerArtist[a]})))
      .flat();

    next.avgTrackPerArtistAsc = this.getTop10(months, m => -m.avg!, k => months[k], m => `${m.alias} (${Math.round(Math.abs(m.avg))} scrobbles per artist)`, v => this.including(v));
    next.avgTrackPerArtistDesc = this.getTop10(months, m => m.avg!, k => months[k], m => `${m.alias} (${Math.round(m.avg)} scrobbles per artist)`, v => this.including(v));
    next.mostListenedNewArtist = this.getTop10(arr, a => a.amount, k => arr[+k], a => `${a.artist} (${a.month})`, a => `${a.amount} times`);

    next.weeksPerArtist = this.getTop10(seen, s => s.weeks.length, k => seen[+k], a => a.name, (i, v) => `${v} weeks`);

    const xTimes = (item: any, v: number) => `${v} times`;
    next.scrobbledHours = this.getTop10(tempStats.hours, k => tempStats.hours[k], k => k, k => `${k}:00-${k}:59`, xTimes);
    next.scrobbledDays = this.getTop10(tempStats.days, k => tempStats.days[k], k => k, k => StatsBuilderService.DAYS[k], xTimes);
    next.scrobbledMonths = this.getTop10(tempStats.months, k => tempStats.months[k], k => k, k => StatsBuilderService.MONTHS[k], xTimes);

    this.stats.next(next);
  }

  private currentScrobbleStreak(tempStats: TempStats, endDate: Date): Streak[] {
    const current = tempStats.scrobbleStreak.current;
    if (current) {
      const currentStreak: Streak = {start: current.start, end: {artist: '?', track: '?', date: endDate}};
      ScrobbleStreakStack.calcLength(currentStreak);
      return [...tempStats.scrobbleStreak.streaks, currentStreak];
    } else {
      return tempStats.scrobbleStreak.streaks;
    }
  }

  getTop10(countMap: {},
           getValue: (k: any) => number,
           getItem: (k: string) => any,
           buildName: (k: any, value: number) => string,
           buildDescription: (item: any, value: number) => string
  ): Top10Item[] {
    const keys = Object.keys(countMap);
    keys.sort((a, b) => getValue(getItem(b)) - getValue(getItem(a)));
    return keys.splice(0, 10).map(k => {
      const item = getItem(k);
      const val = getValue(item);
      return {
        amount: val,
        name: buildName(item, val),
        description: buildDescription(item, val)
      };
    });
  }

  getStreakTop10(streaks: Streak[], buildName = (s: Streak) => `${s.length} days`): Top10Item[] {
    const keys = Object.keys(streaks);
    keys.sort((a, b) => streaks[+b].length! - streaks[+a].length!);
    return keys.splice(0, 10).map(k => {
      const streak = streaks[+k];
      return {
        amount: streak.length!,
        name: buildName(streak),
        description: streak.start.date.toLocaleDateString() + ' - ' + streak.end.date.toLocaleDateString()
      };
    });
  }

  private including(m: Month): string {
    const keys = Object.keys(m.scrobblesPerArtist);
    keys.sort((a, b) => m.scrobblesPerArtist[b] - m.scrobblesPerArtist[a]);
    return keys.splice(0, 3).join(', ');
  }

  private emptyStats(): Stats {
    return {
      scrobbleStreak: [],
      notListenedStreak: [],
      betweenArtists: [],
      ongoingBetweenArtists: [],
      weeksPerArtist: [],
      weekStreakPerArtist: [],
      newArtistsPerMonth: [],
      mostListenedNewArtist: [],
      uniqueArtists: [],
      avgTrackPerArtistAsc: [],
      avgTrackPerArtistDesc: [],
      scrobbledHours: [],
      scrobbledDays: [],
      scrobbledMonths: [],
    };
  }
}
