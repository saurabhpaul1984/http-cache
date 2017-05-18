import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/first';

export class CachedResponse<T> {
  error: any = undefined;
  fetching = false;

  constructor(public data: T, public expiration: number = 0) { }
}

export class Cacher<T> {
  static defaultExpirationWindow = 30000;
  static verbose = true;

  observable: Observable<CachedResponse<T>>;

  refresh: () => void;

  static create<T>(
    source: Observable<T>,
    subject?: BehaviorSubject<CachedResponse<T>>,
    expireAfter = Cacher.defaultExpirationWindow
  ): Cacher<T> {

    if (!subject) {
      subject = new BehaviorSubject<CachedResponse<T>>(new CachedResponse<T>(undefined));
    }

    // execute do() once for its potential side-effect:
    // running source again once and updating the subject with its value
    const refresh = () =>
      subject
        .do(pkg => {
          if (pkg.fetching || pkg.expiration > Date.now()) {
            // if (this.verbose) {
            //   pkg.fetching ?
            //     console.log('Fetching (so we\'ll exit and wait) ...') :
            //     console.log('Using cached data ...', Date.now());
            // }
            return;
          }

          // emit a new package with the same cached data that shows we're fetching
          subject.next({ ...pkg, ...{ fetching: true } });

          source
            .first() // ensure only execute source once
            .subscribe(data => {
              const newPkg = new CachedResponse<T>(data, Date.now() + expireAfter);
              this.verbose && console.log('fetching fresh data', newPkg);
              return subject.next(newPkg);
            },
            error => subject.next({ ...pkg, ...{ fetching: false, error } }),
            () => this.verbose && console.log('fetch completed')
            );
        })
        // execute do() only once; the returned value is irrelevant
        .first()
        .subscribe(
          x => this.verbose && console.log('refresh next', x),
          null,
          () => this.verbose && console.log('refresh completed')
        );
    // .subscribe(null, null, () => this.verbose && console.log('refresh completed'));

    return {
      refresh,
      observable: subject.asObservable()
    };
  }
}
