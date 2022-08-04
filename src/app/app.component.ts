import { ChangeDetectorRef, Component, OnChanges, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Country, State, City } from 'country-state-city';
import { ICountry, IState, ICity } from 'country-state-city/dist/lib/interface';
import {
  debounceTime,
  forkJoin,
  lastValueFrom,
  map,
  Observable,
  of,
  startWith,
} from 'rxjs';
import { API_KEY, API_URL } from '../assets/coutrystatecityApi';
import { HttpClient, HttpHeaders } from '@angular/common/http';

export interface Country {
  id: number;
  name: string;
  iso3: string;
  iso2: string;
  phonecode: string;
  capital: string;
  currency: string;
  native: string;
  emoji: string;
  emojiU: string;
}

export interface City {
  id: number;
  name: string;
  state_id: number;
  state_code: string;
  country_id: number;
  country_code: string;
  latitude: string;
  longitude: string;
}

export interface State {
  id: number;
  name: string;
  country_id: number;
  country_code: string;
  iso2: string;
}

export const _filter = (opt: string[], value: string): string[] => {
  const filterValue = value.toLowerCase();

  return opt.filter((item) => item.toLowerCase().includes(filterValue));
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  allStates?: State[];
  allCities?: City[];
  headers: HttpHeaders | undefined;
  countries?: Country[];
  cities?: City[];
  states: State[] | undefined;
  myForm = this._formBuilder.group({
    country: '',
    state: '',
    city: '',
  });
  data: any;
  countryOptions?: Observable<Country[] | undefined>;
  stateOptions?: Observable<State[] | undefined>;
  cityOptions?: Observable<City[] | undefined>;

  //Template driven form
  viewModel = {
    country: '',
  };

  testingCountries?: ICountry[];

  constructor(
    private _formBuilder: FormBuilder,
    private http: HttpClient, // private service: Service
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    // this.testingCountries = Country.getAllCountries();
    console.log(Country.getAllCountries());
    console.log('Hello world');
    await this.fetchData();
    if (this.countries) {
      this.myForm.get('country')!.valueChanges.subscribe(async (value) => {
        const matchedCountry = this.searchCountry(value);
        if (matchedCountry) {
          await this.filterStatesAndCitiesByCountry(matchedCountry);
        } else {
          await this.getAllStates();
          this.clearCities();
        }
      });
      this.myForm.get('state')!.valueChanges.subscribe(async (value) => {
        const matchedState = this.states?.find((state) => state.name === value);
        const countryName = this.myForm.get('country')?.value;
        const selectedCountry = this.searchCountry(countryName);
        //Case 1: No country and state
        if (!(selectedCountry && matchedState)) {
          this.clearCities();
        }
        //Have country input but the state doesnt match
        if (selectedCountry && !matchedState) {
          //Populate the list of cities by country

          if (selectedCountry !== undefined)
            this.getListOfCitiesByCountry(selectedCountry);
        }
        if (selectedCountry && matchedState) {
          await this.filterCitiesByStateAndCountry(matchedState);
        }
      });
      this.countryOptions = this.myForm.get('country')!.valueChanges.pipe(
        startWith(''),
        map((value) => this._filterCountry(value || ''))
      );
    }
    if (this.states) {
      this.stateOptions = this.myForm.get('state')!.valueChanges.pipe(
        startWith(''),
        map((value) => this._filterState(value || ''))
      );
    }
  }

  // async ngOnChanges() {
  //   if (this.myForm.get('country')!.value !== undefined) {
  //     const selectedCountry = this.myForm.get('country')!.value;
  //     console.log(selectedCountry);
  //     // const requestOptions = this.setApiKeyRequestParams();
  //   }
  // }

  private _filterCountry(value: string) {
    if (value && this.countries) {
      let filterValue: string;
      if (typeof value === 'string') {
        filterValue = value.toLowerCase();
      } else {
        let country = value as Country;
        filterValue = country.name.toLowerCase();
      }
      return this.countries.filter((country) =>
        country.name.toLowerCase().includes(filterValue)
      );
    }
    if (this.countries) {
      return this.countries;
    } else {
      return undefined;
    }
  }

  private _filterState(value: string) {
    if (value && this.states) {
      const filterValue = value.toLowerCase();

      return this.states.filter((state) =>
        state.name.toLowerCase().includes(filterValue)
      );
    }
    if (this.states) {
      return this.states;
    } else {
      return undefined;
    }
  }

  private _filterCity(value: string) {
    if (value && this.cities) {
      const filterValue = value.toLowerCase();

      return this.cities.filter((city) =>
        city.name.toLowerCase().includes(filterValue)
      );
    }
    if (this.cities) {
      return this.cities;
    } else {
      return undefined;
    }
  }

  private async fetchData() {
    const data = await this.getAllDataFromAPI();
    if (this.data) {
      this.countries = this.data.countries$;
      this.states = this.allStates = this.data.states$;
    }
  }

  private async getAllDataFromAPI() {
    const requestOptions = this.setApiKeyRequestParams();
    const countries$ = await this.http.get<Country[]>(
      API_URL + 'countries',
      requestOptions
    );
    const cities$ = await this.http.get<City[]>(
      API_URL + 'cities',
      requestOptions
    );
    const states$ = await this.http.get<State[]>(
      API_URL + 'states',
      requestOptions
    );
    const observable = forkJoin({
      countries$,
      states$,
    });
    this.data = await lastValueFrom(observable);
    // const cities$ = (this.countries = await lastValueFrom(countries$));
  }

  private async getAllCountries() {
    const requestOptions = this.setApiKeyRequestParams();
    const countries$ = await this.http.get<Country[]>(
      API_URL + 'countries',
      requestOptions
    );
    this.countries = await lastValueFrom(countries$);
  }

  private async getAllStates() {
    this.states = this.allStates;
    //Refresh the change of the filtered list
    this.stateOptions = this.myForm.get('state')!.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterState(value || ''))
    );
  }

  //When no countries are selected, no list of cities for autocomplete
  private clearCities() {
    this.cities = undefined;
    this.cityOptions = undefined;
  }

  private async getListOfStatesByCountry(country: Country) {
    const requestOptions = this.setApiKeyRequestParams();
    const states$ = await this.http.get<State[]>(
      API_URL + `countries/${country.iso2}/states`,
      requestOptions
    );
    const filteredStates = await lastValueFrom(states$);
    this.states = [...filteredStates];
    console.log(this.states);
    console.log(this.stateOptions);
    //Refresh the change of the filtered list
    this.stateOptions = this.myForm.get('state')!.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterState(value || ''))
    );
  }

  private async getListOfCitiesByCountry(country: Country) {
    const requestOptions = this.setApiKeyRequestParams();
    const cities$ = await this.http.get<City[]>(
      API_URL + `countries/${country.iso2}/cities`,
      requestOptions
    );
    const filteredCities = await lastValueFrom(cities$);
    this.cities = [...filteredCities];
    this.cityOptions = this.myForm.get('city')!.valueChanges.pipe(
      startWith(''),
      map((value) => this._filterCity(value || ''))
    );
  }

  private async getListOfCitiesByStateAndCountry(
    country: Country,
    state: State
  ) {
    const requestOptions = this.setApiKeyRequestParams();
    const cities$ = await this.http.get<City[]>(
      API_URL + `countries/${country.iso2}/states/${state.iso2}/cities`,
      requestOptions
    );
    const filteredCities = await lastValueFrom(cities$);
    this.cities = [...filteredCities];
    //Refresh the change of the filtered list
    this.cityOptions = this.myForm.get('city')!.valueChanges.pipe(
      startWith(''),
      map((value: string) => this._filterCity(value || ''))
    );
  }

  private setApiKeyRequestParams() {
    const headers = new HttpHeaders().set('X-CSCAPI-KEY', API_KEY);
    const requestOptions = {
      headers: headers,
    };
    return requestOptions;
  }

  getCountryName(country: Country) {
    return country.name;
  }

  async getSelectedCountry(country: Country) {
    await this.getListOfStatesByCountry(country);
    await this.getListOfCitiesByCountry(country);
  }

  async filterStatesAndCitiesByCountry(country: Country) {
    await State.getStatesOfCountry(country.iso2);
    await City.getCitiesOfCountry(country.iso2);
    // await this.getListOfStatesByCountry(country);
    // await this.getListOfCitiesByCountry(country);
  }

  async filterCitiesByStateAndCountry(state: State) {
    if (!this.myForm.get('country')!.value) {
      return;
    }
    const countryName = this.myForm.get('country')!.value;
    const country = this.countries?.find(
      (country) => country.name === countryName
    );
    if (country) {
      await this.getListOfCitiesByStateAndCountry(country, state);
    }
  }

  private searchCountry(selectedCountry: string): Country | undefined {
    const country = this.countries?.find(
      (country) => country.name === selectedCountry
    );
    return country;
  }

  save() {
    console.log(this.myForm.value);
  }
}
